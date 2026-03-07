'use server';

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { SupportTicket, SupportTicketStatus } from './types';

const SUPPORT_TICKETS_FILE = path.join(process.cwd(), 'data', 'support_tickets.json');

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


