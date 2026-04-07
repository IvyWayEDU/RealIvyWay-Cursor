'use server';

import path from 'path';
import crypto from 'crypto';
import type { SupportTicket, SupportTicketStatus } from './types';

const SUPPORT_TICKETS_FILE = path.join(process.cwd(), 'data', 'support_tickets.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

async function ensureDataDirectory(): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dataDir = path.dirname(SUPPORT_TICKETS_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dataDir, { recursive: true });
  } catch {
    // ignore
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (FS_DISABLED_IN_PROD) return fallback;
  try {
    await ensureDataDirectory();
    const fsp = await import('fs/promises');
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  try {
    await ensureDataDirectory();
    const fsp = await import('fs/promises');
    await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
  } catch {
    return;
  }
}

function newId(prefix: string): string {
  const uuid = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export async function getAllSupportTickets(): Promise<SupportTicket[]> {
  return readJsonFile<SupportTicket[]>(SUPPORT_TICKETS_FILE, []);
}

export async function createSupportTicket(input: Omit<SupportTicket, 'id' | 'createdAt' | 'status'> & {
  status?: SupportTicketStatus;
}): Promise<SupportTicket> {
  const all = await getAllSupportTickets();
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: newId('ticket'),
    userId: input.userId,
    role: input.role,
    subject: input.subject,
    message: input.message,
    attachmentUrl: input.attachmentUrl ?? null,
    status: input.status ?? 'open',
    createdAt: now,
  };
  all.push(ticket);
  await writeJsonFile(SUPPORT_TICKETS_FILE, all);
  return ticket;
}


