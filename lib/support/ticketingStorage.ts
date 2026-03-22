'use server';

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

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

const SUPPORT_TICKETS_FILE = path.join(process.cwd(), 'data', 'support_tickets.json');
const SUPPORT_MESSAGES_FILE = path.join(process.cwd(), 'data', 'support_messages.json');

async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(SUPPORT_TICKETS_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {
    // ignore
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    await ensureDataDirectory();
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function newUuid(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function getAllSupportTickets(): Promise<SupportTicketRow[]> {
  return readJsonFile<SupportTicketRow[]>(SUPPORT_TICKETS_FILE, []);
}

export async function getAllSupportMessages(): Promise<SupportMessageRow[]> {
  return readJsonFile<SupportMessageRow[]>(SUPPORT_MESSAGES_FILE, []);
}

export async function saveAllSupportTickets(tickets: SupportTicketRow[]): Promise<void> {
  await writeJsonFile(SUPPORT_TICKETS_FILE, tickets);
}

export async function saveAllSupportMessages(messages: SupportMessageRow[]): Promise<void> {
  await writeJsonFile(SUPPORT_MESSAGES_FILE, messages);
}

export async function getSupportTicketById(ticketId: string): Promise<SupportTicketRow | null> {
  const tickets = await getAllSupportTickets();
  return tickets.find(t => t.id === ticketId) ?? null;
}

export async function getSupportMessagesForTicket(ticketId: string): Promise<SupportMessageRow[]> {
  const messages = await getAllSupportMessages();
  return messages
    .filter(m => m.ticketId === ticketId)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
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
  const [tickets, messages] = await Promise.all([getAllSupportTickets(), getAllSupportMessages()]);

  const filtered = args.forAdmin ? tickets : tickets.filter(t => t.userId === args.userId);

  const meta = filtered.map((t) => {
    const ms = messages.filter(m => m.ticketId === t.id);
    const lastMessageAt = ms.length
      ? ms.reduce((acc, cur) => (cur.createdAt > acc ? cur.createdAt : acc), ms[0].createdAt)
      : t.createdAt;
    const lastMessage = ms.length ? ms.reduce((acc, cur) => (cur.createdAt > acc.createdAt ? cur : acc), ms[0]) : null;
    const previewRaw = String(lastMessage?.message || '').replace(/\s+/g, ' ').trim();
    const lastMessagePreview = previewRaw ? (previewRaw.length > 120 ? `${previewRaw.slice(0, 120)}…` : previewRaw) : '';
    const lastMessageSenderRole = lastMessage?.senderRole ? String(lastMessage.senderRole) : '';
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
  const tickets = await getAllSupportTickets();
  const now = new Date().toISOString();
  const ticket: SupportTicketRow = {
    id: newUuid(),
    userId: input.userId,
    role: input.role,
    subject: input.subject,
    status: input.status ?? 'open',
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    unreadForAdmin: 0,
    unreadForUser: 0,
  };
  tickets.push(ticket);
  await saveAllSupportTickets(tickets);
  return ticket;
}

export async function setSupportTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportTicketRow> {
  const tickets = await getAllSupportTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) throw new Error('Ticket not found');
  const now = new Date().toISOString();
  const nextResolvedAt = (status === 'resolved' || status === 'closed') ? now : null;
  tickets[idx] = {
    ...tickets[idx],
    status,
    updatedAt: now,
    resolvedAt: nextResolvedAt,
  };
  await saveAllSupportTickets(tickets);
  return tickets[idx];
}

export async function markSupportTicketRead(ticketId: string, by: 'admin' | 'user'): Promise<SupportTicketRow> {
  const tickets = await getAllSupportTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) throw new Error('Ticket not found');
  const cur = tickets[idx];
  const now = new Date().toISOString();
  tickets[idx] = {
    ...cur,
    updatedAt: cur.updatedAt ?? now,
    unreadForAdmin: by === 'admin' ? 0 : (cur.unreadForAdmin ?? 0),
    unreadForUser: by === 'user' ? 0 : (cur.unreadForUser ?? 0),
  };
  await saveAllSupportTickets(tickets);
  return tickets[idx];
}

export async function addSupportMessage(input: {
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
}): Promise<SupportMessageRow> {
  const [tickets, messages] = await Promise.all([getAllSupportTickets(), getAllSupportMessages()]);
  const idx = tickets.findIndex(t => t.id === input.ticketId);
  if (idx === -1) throw new Error('Ticket not found');

  const normalizedMessage = typeof input.message === 'string' ? input.message.trim() : '';
  if (!normalizedMessage) throw new Error('Message is required');

  // Protect against duplicate sends (double-click / retries).
  // If the last message for this ticket matches exactly (same senderRole + same trimmed message) within 15s, treat as idempotent.
  const lastForTicket = [...messages]
    .filter(m => m.ticketId === input.ticketId)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(-1)[0];
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

  const now = new Date().toISOString();
  const msg: SupportMessageRow = {
    id: newUuid(),
    ticketId: input.ticketId,
    senderId: input.senderId,
    senderRole: input.senderRole,
    message: normalizedMessage,
    createdAt: now,
  };
  messages.push(msg);

  // Update ticket metadata + unread counters
  const cur = tickets[idx];
  const isAdminSender = String(input.senderRole || '').toLowerCase() === 'admin';
  const unreadForAdmin = cur.unreadForAdmin ?? 0;
  const unreadForUser = cur.unreadForUser ?? 0;
  tickets[idx] = {
    ...cur,
    updatedAt: now,
    unreadForAdmin: isAdminSender ? 0 : (unreadForAdmin + 1),
    unreadForUser: isAdminSender ? (unreadForUser + 1) : 0,
  };

  await Promise.all([saveAllSupportMessages(messages), saveAllSupportTickets(tickets)]);
  return msg;
}

export async function getOrCreateActiveSupportTicketForUser(input: {
  userId: string;
  role: SupportTicketRole;
  subject?: string;
}): Promise<SupportTicketRow> {
  const tickets = await getAllSupportTickets();
  const active = tickets
    .filter(t => t.userId === input.userId && t.status !== 'closed' && t.status !== 'resolved')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];

  if (active) return active;
  return createSupportTicket({
    userId: input.userId,
    role: input.role,
    subject: input.subject ?? 'Support',
    status: 'open',
  });
}


