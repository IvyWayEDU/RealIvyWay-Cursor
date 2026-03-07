'use server';

/**
 * Message + Conversation Storage (dev JSON persistence)
 *
 * - Conversations are identified by the pair of userIds (role-agnostic)
 * - Messages are stored by conversationId and always include:
 *   conversationId, senderId, recipientId, createdAt, text
 */

import fs from 'fs/promises';
import path from 'path';

const CONVERSATIONS_FILE = path.join(process.cwd(), 'data', 'conversations.json');
const MESSAGES_FILE = path.join(process.cwd(), 'data', 'messages.json');

async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(CONVERSATIONS_FILE);
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



