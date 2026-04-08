'use server';

import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export type SupportTicketStatus =
  | 'open'
  | 'pending'
  | 'admin_replied'
  | 'resolved'
  | 'closed'
  | (string & {});

export type SupportTicketRole = 'student' | 'provider' | 'admin' | (string & {});

export interface SupportTicketRow {
  id: string; // UUID
  userId: string; // UUID
  role: SupportTicketRole;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string; // ISO (timestamp default now())
  updatedAt?: string; // ISO
  resolvedAt?: string | null; // ISO
  unreadForAdmin?: number;
  unreadForUser?: number;
}

export interface SupportMessageRow {
  id: string; // UUID
  ticketId: string; // UUID
  senderId: string; // UUID
  senderRole: string;
  message: string;
  createdAt: string; // ISO (timestamp default now())
}

export interface SupportTicketWithMeta extends SupportTicketRow {
  lastMessageAt: string;
  messageCount: number;
  lastMessagePreview?: string;
  lastMessageSenderRole?: string;
}

export interface SupportTicketThread {
  ticket: SupportTicketRow;
  messages: SupportMessageRow[];
}

function newUuid(): string {
  // We store IDs in Postgres as UUIDs, so ensure a real UUID even if randomUUID is unavailable.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type DbSupportTicket = {
  id: string;
  user_id: string;
  role: string | null;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  unread_for_admin: number;
  unread_for_user: number;
};

type DbSupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string | null;
  message: string;
  created_at: string;
};

function mapTicketRow(row: DbSupportTicket): SupportTicketRow {
  return {
    id: row.id,
    userId: row.user_id,
    role: (row.role || 'student') as SupportTicketRole,
    subject: row.subject,
    status: row.status as SupportTicketStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    unreadForAdmin: row.unread_for_admin ?? 0,
    unreadForUser: row.unread_for_user ?? 0,
  };
}

function mapMessageRow(row: DbSupportMessage): SupportMessageRow {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderId: row.sender_id,
    senderRole: row.sender_role ?? '',
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function getAllSupportTickets(): Promise<SupportTicketRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapTicketRow(r as DbSupportTicket));
}

export async function getAllSupportMessages(): Promise<SupportMessageRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapMessageRow(r as DbSupportMessage));
}

export async function getSupportTicketById(ticketId: string): Promise<SupportTicketRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapTicketRow(data as DbSupportTicket);
}

export async function getSupportMessagesForTicket(ticketId: string): Promise<SupportMessageRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapMessageRow(r as DbSupportMessage));
}

export async function getSupportTicketThread(ticketId: string): Promise<SupportTicketThread | null> {
  const ticket = await getSupportTicketById(ticketId);
  if (!ticket) return null;
  const messages = await getSupportMessagesForTicket(ticketId);
  return { ticket, messages };
}

export async function listSupportTickets(args: {
  forAdmin: boolean;
  userId?: string;
}): Promise<SupportTicketWithMeta[]> {
  const supabase = getSupabaseAdmin();

  let ticketQuery = supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (!args.forAdmin) {
    ticketQuery = ticketQuery.eq('user_id', args.userId || '');
  }

  const { data: ticketRows, error: ticketErr } = await ticketQuery;
  if (ticketErr) throw ticketErr;

  const tickets = (ticketRows ?? []).map((r) => mapTicketRow(r as DbSupportTicket));
  if (tickets.length === 0) return [];

  const ticketIds = tickets.map((t) => t.id);
  const { data: msgRows, error: msgErr } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_role, message, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true });
  if (msgErr) throw msgErr;

  const byTicket = new Map<string, Array<{ sender_role: string | null; message: string; created_at: string }>>();
  for (const r of msgRows ?? []) {
    const row = r as unknown as { ticket_id: string; sender_role: string | null; message: string; created_at: string };
    const arr = byTicket.get(row.ticket_id) ?? [];
    arr.push(row);
    byTicket.set(row.ticket_id, arr);
  }

  const meta = tickets.map((t) => {
    const ms = byTicket.get(t.id) ?? [];
    const last = ms.length ? ms[ms.length - 1] : null;
    const lastMessageAt = last?.created_at || t.createdAt;
    const previewRaw = String(last?.message || '').replace(/\s+/g, ' ').trim();
    const lastMessagePreview = previewRaw ? (previewRaw.length > 120 ? `${previewRaw.slice(0, 120)}…` : previewRaw) : '';
    const lastMessageSenderRole = last?.sender_role ? String(last.sender_role) : '';
    const updatedAt = t.updatedAt ?? lastMessageAt;
    const unreadForAdmin = typeof t.unreadForAdmin === 'number' ? t.unreadForAdmin : 0;
    const unreadForUser = typeof t.unreadForUser === 'number' ? t.unreadForUser : 0;
    return {
      ...t,
      lastMessageAt,
      updatedAt,
      unreadForAdmin,
      unreadForUser,
      messageCount: ms.length,
      lastMessagePreview,
      lastMessageSenderRole,
    };
  });

  meta.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  return meta;
}

export async function createSupportTicket(input: {
  userId: string;
  role: SupportTicketRole;
  subject: string;
  status?: SupportTicketStatus;
}): Promise<SupportTicketRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      id: newUuid(),
      user_id: input.userId,
      subject: input.subject,
      status: input.status ?? 'open',
      role: input.role,
      unread_for_admin: 0,
      unread_for_user: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  const ticket = mapTicketRow(data as DbSupportTicket);
  console.log('Support ticket created:', ticket);
  return ticket;
}

export async function setSupportTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportTicketRow> {
  const supabase = getSupabaseAdmin();
  const nextResolvedAt = (status === 'resolved' || status === 'closed') ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('support_tickets')
    .update({
      status,
      resolved_at: nextResolvedAt,
    })
    .eq('id', ticketId)
    .select('*')
    .single();

  if (error) throw error;
  return mapTicketRow(data as DbSupportTicket);
}

export async function markSupportTicketRead(ticketId: string, by: 'admin' | 'user'): Promise<SupportTicketRow> {
  const supabase = getSupabaseAdmin();
  const patch =
    by === 'admin'
      ? { unread_for_admin: 0 }
      : { unread_for_user: 0 };

  const { data, error } = await supabase
    .from('support_tickets')
    .update(patch)
    .eq('id', ticketId)
    .select('*')
    .single();

  if (error) throw error;
  return mapTicketRow(data as DbSupportTicket);
}

export async function addSupportMessage(input: {
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
}): Promise<SupportMessageRow> {
  const supabase = getSupabaseAdmin();

  const normalizedMessage = typeof input.message === 'string' ? input.message.trim() : '';
  if (!normalizedMessage) throw new Error('Message is required');

  const { data: ticketRow, error: ticketErr } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', input.ticketId)
    .single();
  if (ticketErr) throw ticketErr;
  const ticket = mapTicketRow(ticketRow as DbSupportTicket);

  // Protect against duplicate sends (double-click / retries).
  // If the last message for this ticket matches exactly (same senderRole + same trimmed message) within 15s, treat as idempotent.
  const { data: lastRows, error: lastErr } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_id, sender_role, message, created_at')
    .eq('ticket_id', input.ticketId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (lastErr) throw lastErr;
  const lastForTicket = (lastRows?.[0] ? mapMessageRow(lastRows[0] as DbSupportMessage) : null);
  if (lastForTicket) {
    const lastAtMs = Date.parse(String(lastForTicket.createdAt || ''));
    const nowMs = Date.now();
    const lastMsgText = typeof lastForTicket.message === 'string' ? lastForTicket.message.trim() : '';
    const lastRole = typeof lastForTicket.senderRole === 'string' ? lastForTicket.senderRole.trim().toLowerCase() : '';
    const curRole = typeof input.senderRole === 'string' ? input.senderRole.trim().toLowerCase() : '';
    if (
      lastMsgText === normalizedMessage &&
      lastRole === curRole &&
      Number.isFinite(lastAtMs) &&
      nowMs - lastAtMs >= 0 &&
      nowMs - lastAtMs < 15_000
    ) {
      return lastForTicket;
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('support_messages')
    .insert({
      id: newUuid(),
      ticket_id: input.ticketId,
      sender_id: input.senderId,
      sender_role: input.senderRole,
      message: normalizedMessage,
    })
    .select('*')
    .single();
  if (insertErr) throw insertErr;

  const isAdminSender = String(input.senderRole || '').toLowerCase() === 'admin';
  const unreadForAdmin = ticket.unreadForAdmin ?? 0;
  const unreadForUser = ticket.unreadForUser ?? 0;
  const nextUnreadForAdmin = isAdminSender ? 0 : (unreadForAdmin + 1);
  const nextUnreadForUser = isAdminSender ? (unreadForUser + 1) : 0;

  const { error: updErr } = await supabase
    .from('support_tickets')
    .update({
      unread_for_admin: nextUnreadForAdmin,
      unread_for_user: nextUnreadForUser,
    })
    .eq('id', input.ticketId);
  if (updErr) throw updErr;

  const msg = mapMessageRow(inserted as DbSupportMessage);
  console.log('Support message sent:', msg);
  return msg;
}

export async function getOrCreateActiveSupportTicketForUser(input: {
  userId: string;
  role: SupportTicketRole;
  subject?: string;
}): Promise<SupportTicketRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', input.userId)
    .neq('status', 'closed')
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const active = data?.[0] ? mapTicketRow(data[0] as DbSupportTicket) : null;
  if (active) return active;

  return createSupportTicket({
    userId: input.userId,
    role: input.role,
    subject: input.subject ?? 'Support',
    status: 'open',
  });
}


