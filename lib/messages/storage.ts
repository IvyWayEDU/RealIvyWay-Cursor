'use server';

/**
 * Message + Conversation Storage (Supabase persistence)
 *
 * Tables:
 * - conversations: id, participant_a, participant_b, created_at, updated_at
 * - messages: id, conversation_id, sender_id, body, created_at
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export interface StoredConversation {
  id: string; // conversationId
  participantA: string;
  participantB: string;
  participants: [string, string];
  createdAt: string;
  updatedAt: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  text: string;
}

type ConversationRow = {
  id: string | null;
  participant_a: string | null;
  participant_b: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MessageRow = {
  id: string | null;
  conversation_id: string | null;
  sender_id: string | null;
  body: string | null;
  created_at: string | null;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function mapConversationRow(
  row: ConversationRow,
  last?: { body?: string | null; created_at?: string | null; sender_id?: string | null } | null
): StoredConversation | null {
  const id = isNonEmptyString(row?.id) ? row.id.trim() : '';
  const a = isNonEmptyString(row?.participant_a) ? row.participant_a.trim() : '';
  const b = isNonEmptyString(row?.participant_b) ? row.participant_b.trim() : '';
  if (!id || !a || !b) return null;

  const createdAt = isNonEmptyString(row?.created_at) ? row.created_at : new Date().toISOString();
  const updatedAt = isNonEmptyString(row?.updated_at) ? row.updated_at : createdAt;
  const participants = normalizePair(a, b);

  const lastMessageText = isNonEmptyString(last?.body) ? String(last?.body) : undefined;
  const lastMessageAt = isNonEmptyString(last?.created_at) ? String(last?.created_at) : undefined;
  const lastMessageSenderId = isNonEmptyString(last?.sender_id) ? String(last?.sender_id) : undefined;

  return {
    id,
    participantA: a,
    participantB: b,
    participants,
    createdAt,
    updatedAt,
    lastMessageText,
    lastMessageAt,
    lastMessageSenderId,
  };
}

export async function getConversationById(conversationId: string): Promise<StoredConversation | null> {
  const cid = String(conversationId || '').trim();
  if (!cid) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, participant_a, participant_b, created_at, updated_at')
    .eq('id', cid)
    .maybeSingle();
  if (error) {
    console.error('[messages.storage] Error loading conversation:', { conversationId: cid, error });
    throw error;
  }

  if (!data) return null;
  return mapConversationRow(data as any, null);
}

export async function ensureConversationRow(params: {
  id: string;
  participantA: string;
  participantB: string;
}): Promise<StoredConversation> {
  const id = String(params?.id || '').trim();
  const participantA = String(params?.participantA || '').trim();
  const participantB = String(params?.participantB || '').trim();
  if (!id || !participantA || !participantB) {
    throw new Error('Invalid conversation params');
  }

  const [a, b] = normalizePair(participantA, participantB);
  const supabase = getSupabaseAdmin();

  // Deterministic id means this is safe/idempotent.
  const { data, error } = await supabase
    .from('conversations')
    .upsert({ id, participant_a: a, participant_b: b }, { onConflict: 'id' })
    .select('id, participant_a, participant_b, created_at, updated_at')
    .single();
  if (error) {
    console.error('[messages.storage] Error ensuring conversation:', { id, error });
    throw error;
  }

  const mapped = mapConversationRow(data as any, null);
  if (!mapped) throw new Error('Failed to map conversation row');
  return mapped;
}

export async function getConversationsForUser(userId: string): Promise<StoredConversation[]> {
  const uid = String(userId || '').trim();
  if (!uid) return [];

  const supabase = getSupabaseAdmin();
  const { data: convRows, error: convErr } = await supabase
    .from('conversations')
    .select('id, participant_a, participant_b, created_at, updated_at')
    .or(`participant_a.eq.${uid},participant_b.eq.${uid}`);
  if (convErr) {
    console.error('[messages.storage] Error loading conversations for user:', { userId: uid, error: convErr });
    throw convErr;
  }

  const rows = (convRows ?? []) as any[];
  const conversationIds = rows
    .map((r) => (isNonEmptyString(r?.id) ? String(r.id).trim() : ''))
    .filter(Boolean);

  // Fetch last message per conversation in one pass (best-effort).
  const lastByConversationId = new Map<
    string,
    { body: string | null; created_at: string | null; sender_id: string | null }
  >();

  if (conversationIds.length > 0) {
    const { data: msgRows, error: msgErr } = await supabase
      .from('messages')
      .select('conversation_id, body, created_at, sender_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });
    if (msgErr) {
      console.error('[messages.storage] Error loading last messages for conversations:', { userId: uid, error: msgErr });
      throw msgErr;
    }

    for (const r of (msgRows ?? []) as any[]) {
      const cid = isNonEmptyString(r?.conversation_id) ? String(r.conversation_id).trim() : '';
      if (!cid) continue;
      if (lastByConversationId.has(cid)) continue;
      lastByConversationId.set(cid, {
        body: (r as any)?.body ?? null,
        created_at: (r as any)?.created_at ?? null,
        sender_id: (r as any)?.sender_id ?? null,
      });
    }
  }

  return rows
    .map((r) => {
      const cid = isNonEmptyString((r as any)?.id) ? String((r as any).id).trim() : '';
      return mapConversationRow(r as ConversationRow, lastByConversationId.get(cid) || null);
    })
    .filter(Boolean) as StoredConversation[];
}

export async function getMessagesForConversation(conversationId: string): Promise<StoredMessage[]> {
  const cid = String(conversationId || '').trim();
  if (!cid) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', cid)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[messages.storage] Error loading messages:', { conversationId: cid, error });
    throw error;
  }

  return ((data ?? []) as any[])
    .map((row: MessageRow) => {
      const id = isNonEmptyString(row?.id) ? String(row.id).trim() : '';
      const conversationId = isNonEmptyString(row?.conversation_id) ? String(row.conversation_id).trim() : '';
      const senderId = isNonEmptyString(row?.sender_id) ? String(row.sender_id).trim() : '';
      const createdAt = isNonEmptyString(row?.created_at) ? String(row.created_at) : new Date().toISOString();
      const text = isNonEmptyString(row?.body) ? String(row.body) : '';
      if (!id || !conversationId || !senderId) return null;
      return { id, conversationId, senderId, createdAt, text } satisfies StoredMessage;
    })
    .filter(Boolean) as StoredMessage[];
}

export async function insertMessageRow(params: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<StoredMessage> {
  const id = String(params?.id || '').trim();
  const conversationId = String(params?.conversationId || '').trim();
  const senderId = String(params?.senderId || '').trim();
  const body = String(params?.body || '');
  if (!id || !conversationId || !senderId || !body.trim()) {
    throw new Error('Invalid message params');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .insert({ id, conversation_id: conversationId, sender_id: senderId, body })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();
  if (error) {
    console.error('[messages.storage] Error inserting message:', { conversationId, error });
    throw error;
  }

  const row = data as any as MessageRow;
  const mapped: StoredMessage = {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    createdAt: isNonEmptyString(row?.created_at) ? String(row.created_at) : new Date().toISOString(),
    text: isNonEmptyString(row?.body) ? String(row.body) : '',
  };
  return mapped;
}



