'use server';

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export type SupportTicketStatus = 'open' | 'admin_replied' | 'closed' | (string & {});

export type SupportTicketRole = 'student' | 'provider' | 'admin' | (string & {});

export interface SupportTicketRow {
  id: string; // UUID
  userId: string; // UUID
  role: SupportTicketRole;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string; // ISO (timestamp default now())
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
    return { ...t, lastMessageAt, messageCount: ms.length };
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
  };
  tickets.push(ticket);
  await saveAllSupportTickets(tickets);
  return ticket;
}

export async function setSupportTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportTicketRow> {
  const tickets = await getAllSupportTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) throw new Error('Ticket not found');
  tickets[idx] = { ...tickets[idx], status };
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
  const exists = tickets.some(t => t.id === input.ticketId);
  if (!exists) throw new Error('Ticket not found');

  const now = new Date().toISOString();
  const msg: SupportMessageRow = {
    id: newUuid(),
    ticketId: input.ticketId,
    senderId: input.senderId,
    senderRole: input.senderRole,
    message: input.message,
    createdAt: now,
  };
  messages.push(msg);
  await saveAllSupportMessages(messages);
  return msg;
}

export async function getOrCreateActiveSupportTicketForUser(input: {
  userId: string;
  role: SupportTicketRole;
  subject?: string;
}): Promise<SupportTicketRow> {
  const tickets = await getAllSupportTickets();
  const active = tickets
    .filter(t => t.userId === input.userId && t.status !== 'closed')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];

  if (active) return active;
  return createSupportTicket({
    userId: input.userId,
    role: input.role,
    subject: input.subject ?? 'Support',
    status: 'open',
  });
}


