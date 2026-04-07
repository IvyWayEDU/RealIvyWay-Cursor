'use server';

import path from 'path';
import crypto from 'crypto';
import { SupportConversation, SupportConversationStatus, SupportMessage, SupportMessageSender } from './types';

const SUPPORT_CONVERSATIONS_FILE = path.join(process.cwd(), 'data', 'support_conversations.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

async function ensureDataDirectory(): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dataDir = path.dirname(SUPPORT_CONVERSATIONS_FILE);
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
  // crypto.randomUUID is available in Node 20+, but keep a safe fallback anyway.
  const uuid = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export async function getAllSupportConversations(): Promise<SupportConversation[]> {
  return readJsonFile<SupportConversation[]>(SUPPORT_CONVERSATIONS_FILE, []);
}

export async function saveAllSupportConversations(conversations: SupportConversation[]): Promise<void> {
  await writeJsonFile(SUPPORT_CONVERSATIONS_FILE, conversations);
}

export async function getSupportConversationById(id: string): Promise<SupportConversation | null> {
  const conversations = await getAllSupportConversations();
  return conversations.find(c => c.id === id) ?? null;
}

export async function getOpenSupportConversationForUser(userId: string): Promise<SupportConversation | null> {
  const conversations = await getAllSupportConversations();
  return conversations.find(c => c.userId === userId && c.status === 'open') ?? null;
}

export async function getOrCreateOpenSupportConversationForUser(userId: string): Promise<SupportConversation> {
  const conversations = await getAllSupportConversations();
  const existing = conversations.find(c => c.userId === userId && c.status === 'open');
  if (existing) return existing;

  const now = new Date().toISOString();
  const created: SupportConversation = {
    id: newId('support'),
    userId,
    messages: [],
    status: 'open',
    createdAt: now,
    updatedAt: now,
    lastReadByUserAt: now,
    lastReadByAdminAt: undefined,
  };
  conversations.push(created);
  await saveAllSupportConversations(conversations);
  return created;
}

export async function appendSupportMessage(args: {
  conversationId: string;
  sender: SupportMessageSender;
  senderId?: string;
  text: string;
}): Promise<SupportConversation> {
  const conversations = await getAllSupportConversations();
  const convo = conversations.find(c => c.id === args.conversationId);
  if (!convo) {
    throw new Error('Conversation not found');
  }
  const normalizedText = typeof args.text === 'string' ? args.text.trim() : '';
  if (!normalizedText) {
    throw new Error('Message text is required');
  }

  // Protect against duplicate sends (double-click / client retries).
  // If the last message matches exactly (same sender + same trimmed text) within 15s, treat as idempotent.
  const last = Array.isArray(convo.messages) && convo.messages.length > 0 ? convo.messages[convo.messages.length - 1] : null;
  if (last && last.sender === args.sender) {
    const lastText = typeof last.text === 'string' ? last.text.trim() : '';
    const lastAtMs = Date.parse(String(last.createdAt || ''));
    const nowMs = Date.now();
    if (lastText === normalizedText && Number.isFinite(lastAtMs) && nowMs - lastAtMs >= 0 && nowMs - lastAtMs < 15_000) {
      return convo;
    }
  }

  const now = new Date().toISOString();
  const msg: SupportMessage = {
    id: newId('msg'),
    sender: args.sender,
    senderId: args.senderId,
    text: normalizedText,
    createdAt: now,
  };
  convo.messages.push(msg);
  convo.updatedAt = now;
  await saveAllSupportConversations(conversations);
  return convo;
}

export async function setSupportConversationStatus(conversationId: string, status: SupportConversationStatus): Promise<SupportConversation> {
  const conversations = await getAllSupportConversations();
  const convo = conversations.find(c => c.id === conversationId);
  if (!convo) {
    throw new Error('Conversation not found');
  }
  const now = new Date().toISOString();
  convo.status = status;
  convo.updatedAt = now;
  await saveAllSupportConversations(conversations);
  return convo;
}

export async function assignSupportConversation(conversationId: string, adminId: string | undefined): Promise<SupportConversation> {
  const conversations = await getAllSupportConversations();
  const convo = conversations.find(c => c.id === conversationId);
  if (!convo) {
    throw new Error('Conversation not found');
  }
  const now = new Date().toISOString();
  convo.assignedAdminId = adminId;
  convo.updatedAt = now;
  await saveAllSupportConversations(conversations);
  return convo;
}

export async function markSupportConversationRead(args: {
  conversationId: string;
  reader: 'user' | 'admin';
}): Promise<SupportConversation> {
  const conversations = await getAllSupportConversations();
  const convo = conversations.find(c => c.id === args.conversationId);
  if (!convo) {
    throw new Error('Conversation not found');
  }
  const now = new Date().toISOString();
  if (args.reader === 'user') {
    convo.lastReadByUserAt = now;
  } else {
    convo.lastReadByAdminAt = now;
  }
  convo.updatedAt = now;
  await saveAllSupportConversations(conversations);
  return convo;
}



