'use server';

import crypto from 'crypto';
import { getUserDisplayInfoById } from '@/lib/sessions/actions';
import { getSessions } from '@/lib/sessions/storage';
import type { Session } from '@/lib/models/types';
import {
  getAllConversations,
  getAllMessages,
  saveAllConversations,
  saveAllMessages,
  type StoredConversation,
  type StoredMessage,
} from '@/lib/messages/storage';

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
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function makeConversationId(userAId: string, userBId: string): string {
  const [a, b] = normalizePair(userAId, userBId);
  // Deterministic + role-agnostic: same ID for both users
  return `conv_${a}__${b}`;
}

async function findConversationById(conversationId: string): Promise<StoredConversation | null> {
  const conversations = await getAllConversations();
  return conversations.find((c) => c.id === conversationId) ?? null;
}

async function ensureConversation(userAId: string, userBId: string): Promise<StoredConversation> {
  const conversationId = makeConversationId(userAId, userBId);
  const conversations = await getAllConversations();
  const existing = conversations.find((c) => c.id === conversationId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const participants = normalizePair(userAId, userBId);
  const created: StoredConversation = {
    id: conversationId,
    participants,
    createdAt: now,
    updatedAt: now,
    lastMessageText: '',
    lastMessageAt: now,
    lastMessageSenderId: undefined,
  };

  conversations.push(created);
  await saveAllConversations(conversations);
  return created;
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

function safeDateMs(iso?: string | null): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function getSessionStartEndMs(s: Session): { startMs: number; endMs: number } {
  const startIso = (s as any).scheduledStartTime || (s as any).scheduledStart || (s as any).startTime;
  const endIso = (s as any).scheduledEndTime || (s as any).scheduledEnd || (s as any).endTime;
  return { startMs: safeDateMs(startIso), endMs: safeDateMs(endIso) };
}

function sanitizeMessageText(raw: string): { text: string; changed: boolean } {
  let changed = false;
  let text = raw;

  const replaceAll = (re: RegExp) => {
    const next = text.replace(re, '***');
    if (next !== text) changed = true;
    text = next;
  };

  // Emails
  replaceAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi);
  // URLs (http(s), www.)
  replaceAll(/\b(?:https?:\/\/|www\.)[^\s]+\b/gi);
  // Phone numbers (very loose; catches common US/international formats)
  replaceAll(/\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g);
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
    'upcoming',
    'scheduled',
    'in_progress',
    'in_progress_pending_join',
    'completed',
    'requires_review',
    'no-show',
    'no_show_student',
    'no_show_provider',
    'student_no_show',
    'provider_no_show',
    'expired_provider_no_show',
  ]);

  const eligible = pair.filter((s) => eligibleStatuses.has(s.status));
  if (eligible.length === 0) {
    throw makeFriendlyError('Messaging is only available between users who have a booked session together.');
  }

  const nowMs = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;

  const inWindow = eligible.some((s) => {
    const { startMs, endMs } = getSessionStartEndMs(s);
    if (!Number.isFinite(startMs)) return false;
    // If end time is missing, fall back to start time for the post window.
    const effectiveEndMs = Number.isFinite(endMs) ? endMs : startMs;
    return nowMs >= (startMs - windowMs) && nowMs <= (effectiveEndMs + windowMs);
  });

  if (!inWindow) {
    throw makeFriendlyError(
      'Messaging is only available from 24 hours before a scheduled session until 24 hours after it ends.'
    );
  }
}

export async function getInboxConversations(currentUserId: string): Promise<ConversationSummary[]> {
  const conversations = await getAllConversations();
  const mine = conversations.filter((c) => c.participants.includes(currentUserId));

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

export async function getConversationMessages(conversationId: string): Promise<MessageDTO[]> {
  // Fetch by conversationId ONLY
  const all = await getAllMessages();
  return all
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      recipientId: m.recipientId,
      createdAt: m.createdAt,
      text: m.text,
    }));
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
  const now = new Date().toISOString();

  const message: StoredMessage = {
    id: crypto.randomUUID(),
    conversationId: conversation.id,
    senderId,
    recipientId,
    createdAt: now,
    text,
  };

  const messages = await getAllMessages();
  messages.push(message);
  await saveAllMessages(messages);

  // Update conversation metadata
  const conversations = await getAllConversations();
  const idx = conversations.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) {
    conversations[idx] = {
      ...conversations[idx],
      updatedAt: now,
      lastMessageText: text,
      lastMessageAt: now,
      lastMessageSenderId: senderId,
    };
    await saveAllConversations(conversations);
  }

  return {
    conversationId: conversation.id,
    message: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      createdAt: message.createdAt,
      text: message.text,
    },
  };
}

export async function ensureConversationExistsForPair(userAId: string, userBId: string): Promise<{ conversationId: string }> {
  const c = await ensureConversation(userAId, userBId);
  return { conversationId: c.id };
}




