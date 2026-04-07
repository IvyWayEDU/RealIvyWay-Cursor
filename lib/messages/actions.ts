'use server';

import crypto from 'crypto';
import { getUserDisplayInfoById } from '@/lib/sessions/actions';
import { getSessions } from '@/lib/sessions/storage';
import type { Session } from '@/lib/models/types';
import {
  ensureConversationRow,
  getConversationById,
  getConversationsForUser,
  getMessagesForConversation,
  insertMessageRow,
  type StoredConversation,
} from '@/lib/messages/storage';
import {
  containsPersonalContactInfo,
  PERSONAL_CONTACT_INFO_BLOCK_MESSAGE,
} from '@/lib/messages/contentFilter';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export type ServiceTypeLabel = 'Tutoring' | 'Counseling' | 'Test Prep' | 'College Planning';

export interface ConversationSummary {
  id: string; // conversationId
  participantId: string; // the other user
  participantName: string;
  serviceType: ServiceTypeLabel;
  lastMessage: string;
  lastMessageTime: string; // ISO
  unreadCount?: number;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  createdAt: string; // ISO
  text: string;
  // Backwards-compatible alias used by earlier frontend iterations.
  message: string;
}

export interface DashboardMessagePreview {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function makeConversationId(userAId: string, userBId: string): string {
  const [a, b] = normalizePair(userAId, userBId);
  // Deterministic + role-agnostic: same ID for both users
  return `conv_${a}__${b}`;
}

async function findConversationById(conversationId: string): Promise<StoredConversation | null> {
  return getConversationById(conversationId);
}

async function ensureConversation(userAId: string, userBId: string): Promise<StoredConversation> {
  const conversationId = makeConversationId(userAId, userBId);
  return ensureConversationRow({
    id: conversationId,
    participantA: userAId,
    participantB: userBId,
  });
}

function otherParticipant(conversation: StoredConversation, currentUserId: string): string | null {
  const [a, b] = conversation.participants;
  if (a === currentUserId) return b;
  if (b === currentUserId) return a;
  return null;
}

function makeFriendlyError(message: string): Error {
  const err = new Error(message);
  err.name = 'MessagingRestrictedError';
  return err;
}

function sanitizeMessageText(raw: string): { text: string; changed: boolean } {
  let changed = false;
  let text = raw;

  const replaceAll = (re: RegExp) => {
    const next = text.replace(re, '***');
    if (next !== text) changed = true;
    text = next;
  };

  // URLs (http(s), www.)
  replaceAll(/\b(?:https?:\/\/|www\.)[^\s]+\b/gi);
  // Social media handles (e.g. @john_doe)
  replaceAll(/(^|\s)@[A-Za-z0-9_]{2,}\b/g);

  // Emojis (Unicode property; fallback if unsupported)
  try {
    const emojiRe = /\p{Extended_Pictographic}+/gu;
    replaceAll(emojiRe);
  } catch {
    replaceAll(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu);
  }

  // Normalize extra whitespace
  const collapsed = text.replace(/\s{2,}/g, ' ').trim();
  if (collapsed !== text) changed = true;
  text = collapsed;

  return { text, changed };
}

async function assertMessagingAllowed(senderId: string, recipientId: string): Promise<void> {
  const all = await getSessions();
  const pair = all.filter(
    (s) =>
      (s.studentId === senderId && s.providerId === recipientId) ||
      (s.studentId === recipientId && s.providerId === senderId)
  );

  // Must have at least one real booked session together.
  const eligibleStatuses = new Set<Session['status']>([
    'paid',
    'confirmed',
    'upcoming',
    'scheduled',
    'in_progress',
    'in_progress_pending_join',
    'flagged',
    'completed',
    'completed_provider_show',
    'completed_no_show_provider',
    'completed_no_show_student',
    'requires_review',
    'no-show',
    'no_show_student',
    'no_show_provider',
    'no_show_both',
    'student_no_show',
    'provider_no_show',
    'expired_provider_no_show',
  ]);

  const windowError = 'Messaging only allowed 24 hours before and after session';
  const eligible = pair.filter((s) => eligibleStatuses.has(s.status));
  if (eligible.length === 0) {
    throw new Error(windowError);
  }

  const now = new Date();
  const windowMs = 24 * 60 * 60 * 1000;

  const inWindow = eligible.some((session) => {
    const sessionStart = new Date((session as any).datetime);
    const sessionEnd = new Date((session as any).end_datetime || (session as any).datetime);

    const allowedStart = new Date(sessionStart.getTime() - windowMs);
    const allowedEnd = new Date(sessionEnd.getTime() + windowMs);

    return now >= allowedStart && now <= allowedEnd;
  });

  if (!inWindow) {
    throw new Error(windowError);
  }
}

export async function getInboxConversations(currentUserId: string): Promise<ConversationSummary[]> {
  const mine = await getConversationsForUser(currentUserId);

  const summaries: ConversationSummary[] = [];
  for (const c of mine) {
    const participantId = otherParticipant(c, currentUserId);
    if (!participantId) continue;

    const info = await getUserDisplayInfoById(participantId);
    const participantName = info.displayName || 'User';

    summaries.push({
      id: c.id,
      participantId,
      participantName,
      serviceType: 'Tutoring',
      lastMessage: c.lastMessageText || '',
      lastMessageTime: c.lastMessageAt || c.updatedAt || c.createdAt,
      unreadCount: 0,
    });
  }

  // Newest first
  summaries.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
  return summaries;
}

/**
 * Dashboard messages preview (latest 5).
 *
 * Fetch order:
 * - conversations where user is participant
 * - messages where sender_id = userId OR conversation_id in those conversations
 *
 * Returns the snake_case shape the dashboard preview expects:
 * { id, body, sender_id, created_at }
 */
export async function getDashboardLatestMessages(userId: string): Promise<DashboardMessagePreview[]> {
  const uid = String(userId || '').trim();
  if (!uid) return [];

  const supabase = getSupabaseAdmin();

  // 1) Fetch conversation ids first (required for message filter)
  const { data: convRows, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .or(`participant_a.eq.${uid},participant_b.eq.${uid}`);

  if (convErr) {
    console.error('[messages.actions] Error loading conversations for dashboard preview:', {
      userId: uid,
      error: convErr,
    });
    throw convErr;
  }

  const conversationIds = (convRows ?? [])
    .map((r: any) => (isNonEmptyString(r?.id) ? String(r.id).trim() : ''))
    .filter(Boolean);

  // 2) Fetch latest messages
  const base = supabase
    .from('messages')
    .select('id, body, sender_id, created_at, conversation_id')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: msgRows, error: msgErr } =
    conversationIds.length > 0
      ? await base.or(`sender_id.eq.${uid},conversation_id.in.(${conversationIds.join(',')})`)
      : await base.eq('sender_id', uid);

  if (msgErr) {
    console.error('[messages.actions] Error loading messages for dashboard preview:', { userId: uid, error: msgErr });
    throw msgErr;
  }

  return ((msgRows ?? []) as any[])
    .map((r) => {
      const id = isNonEmptyString(r?.id) ? String(r.id).trim() : '';
      const body = isNonEmptyString(r?.body) ? String(r.body) : '';
      const sender_id = isNonEmptyString(r?.sender_id) ? String(r.sender_id).trim() : '';
      const created_at = isNonEmptyString(r?.created_at) ? String(r.created_at) : '';
      if (!id || !sender_id || !created_at) return null;
      return { id, body, sender_id, created_at } satisfies DashboardMessagePreview;
    })
    .filter(Boolean) as DashboardMessagePreview[];
}

export async function getConversationMessages(conversationId: string): Promise<MessageDTO[]> {
  const convo = await findConversationById(conversationId);
  if (!convo) return [];

  const stored = await getMessagesForConversation(conversationId);
  return stored.map((m) => {
    const recipientId = otherParticipant(convo, m.senderId) || '';
    const text = m.text;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      recipientId,
      createdAt: m.createdAt,
      text,
      message: text,
    };
  });
}

export async function getOrCreateConversationWithUser(
  currentUserId: string,
  otherUserId: string
): Promise<{ conversationId: string }> {
  const c = await ensureConversation(currentUserId, otherUserId);
  return { conversationId: c.id };
}

export async function sendMessage(params: {
  senderId: string;
  recipientId: string;
  text: string;
}): Promise<{ conversationId: string; message: MessageDTO }> {
  const senderId = (params.senderId || '').trim();
  const recipientId = (params.recipientId || '').trim();
  const rawText = (params.text || '').trim();

  if (!senderId || !recipientId) {
    throw new Error('Missing senderId or recipientId');
  }
  if (!rawText) {
    throw new Error('Message text is empty');
  }

  // Enforce session-based messaging restrictions server-side.
  await assertMessagingAllowed(senderId, recipientId);

  // Hard-block personal contact info attempts (to prevent off-platform payment bypass).
  if (containsPersonalContactInfo(rawText)) {
    throw makeFriendlyError(PERSONAL_CONTACT_INFO_BLOCK_MESSAGE);
  }

  // Enforce content filtering before saving.
  const { text, changed } = sanitizeMessageText(rawText);
  if (!text) {
    throw makeFriendlyError('Please remove contact info, links, or emojis and try again.');
  }
  // If we stripped everything but asterisks/spaces, treat as invalid to avoid meaningless messages.
  if (/^[*\s]+$/.test(text)) {
    throw makeFriendlyError('Please remove contact info, links, or emojis and try again.');
  }
  // If message contained disallowed content, we sanitize instead of blocking to avoid breaking delivery.
  // (Client will display the sanitized message after refresh.)
  void changed;

  const conversation = await ensureConversation(senderId, recipientId);
  const conversationId = conversation.id;
  console.log("Conversation loaded:", conversationId);

  const body = text;
  console.log("Sending message:", body);

  const inserted = await insertMessageRow({
    id: crypto.randomUUID(),
    conversationId,
    senderId,
    body,
  });

  return {
    conversationId,
    message: {
      id: inserted.id,
      conversationId: inserted.conversationId,
      senderId: inserted.senderId,
      recipientId,
      createdAt: inserted.createdAt,
      text: inserted.text,
      message: inserted.text,
    },
  };
}

export async function ensureConversationExistsForPair(userAId: string, userBId: string): Promise<{ conversationId: string }> {
  const c = await ensureConversation(userAId, userBId);
  return { conversationId: c.id };
}




