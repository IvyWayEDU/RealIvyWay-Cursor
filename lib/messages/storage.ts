'use server';

/**
 * Message + Conversation Storage (dev JSON persistence)
 *
 * - Conversations are identified by the pair of userIds (role-agnostic)
 * - Messages are stored by conversationId and always include:
 *   conversationId, senderId, recipientId, createdAt, text
 */

import path from 'path';

const CONVERSATIONS_FILE = path.join(process.cwd(), 'data', 'conversations.json');
const MESSAGES_FILE = path.join(process.cwd(), 'data', 'messages.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

async function ensureDataDirectory(): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dataDir = path.dirname(CONVERSATIONS_FILE);
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

export interface StoredConversation {
  id: string; // conversationId
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
  recipientId: string;
  createdAt: string;
  text: string;
}

export async function getAllConversations(): Promise<StoredConversation[]> {
  return readJsonFile<StoredConversation[]>(CONVERSATIONS_FILE, []);
}

export async function saveAllConversations(conversations: StoredConversation[]): Promise<void> {
  await writeJsonFile(CONVERSATIONS_FILE, conversations);
}

export async function getAllMessages(): Promise<StoredMessage[]> {
  return readJsonFile<StoredMessage[]>(MESSAGES_FILE, []);
}

export async function saveAllMessages(messages: StoredMessage[]): Promise<void> {
  await writeJsonFile(MESSAGES_FILE, messages);
}



