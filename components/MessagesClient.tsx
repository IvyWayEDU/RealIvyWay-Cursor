'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Session } from '@/lib/auth/types';
import { useSearchParams } from 'next/navigation';
import { getUserDisplayInfoById } from '@/lib/sessions/actions';
import {
  containsPersonalContactInfo,
  PERSONAL_CONTACT_INFO_BLOCK_MESSAGE,
} from '@/lib/messages/contentFilter';
import {
  getConversationMessages,
  getInboxConversations,
  sendMessage,
} from '@/lib/messages/actions';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  text: string;
  senderName: string;
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  serviceType: 'Tutoring' | 'Counseling' | 'Test Prep' | 'College Planning';
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount?: number;
}

interface MessagesClientProps {
  session: Session;
  userRole: 'student' | 'provider';
}

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) {
    return 'Just now';
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

const formatMessageTime = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (messageDate.getTime() === today.getTime() - 86400000) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
};

export default function MessagesClient({ session, userRole }: MessagesClientProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participantImageUrls, setParticipantImageUrls] = useState<Record<string, string | null>>({});
  const [draftParticipantId, setDraftParticipantId] = useState<string | null>(null);
  const [draftParticipantName, setDraftParticipantName] = useState<string>('User');
  const [draftParticipantImageUrl, setDraftParticipantImageUrl] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const lastSelectedRef = useRef<string | null>(null);

  function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
    const [imageError, setImageError] = useState(false);
    const initial = (name?.trim()?.[0] || 'U').toUpperCase();
    const showImage = !!imageUrl && !imageError;

    return showImage ? (
      <img
        src={imageUrl as string}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
        onError={() => setImageError(true)}
      />
    ) : (
      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-700 text-sm font-semibold">{initial}</span>
      </div>
    );
  }

  // Keep local conversations in sync with role/user changes (UI-only)
  useEffect(() => {
    setSelectedConversationId(null);
    setMessages([]);
    setDraftParticipantId(null);
    setParticipantImageUrls({});

    let cancelled = false;
    (async () => {
      try {
        const inbox = await getInboxConversations(session.userId);
        if (cancelled) return;
        setConversations(
          inbox.map((c) => ({
            id: c.id,
            participantId: c.participantId,
            participantName: c.participantName,
            serviceType: c.serviceType,
            lastMessage: c.lastMessage,
            lastMessageTime: new Date(c.lastMessageTime),
            unreadCount: c.unreadCount,
          }))
        );
      } catch {
        // keep empty state
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.userId, userRole]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hydrate participant avatars (best-effort, UI-only)
  useEffect(() => {
    const ids = Array.from(new Set(conversations.map((c) => c.participantId).filter(Boolean)));
    if (ids.length === 0) return;
    let cancelled = false;

    (async () => {
      const next: Record<string, string | null> = {};
      for (const id of ids) {
        try {
          const { profileImageUrl } = await getUserDisplayInfoById(id);
          next[id] = profileImageUrl ?? null;
        } catch {
          next[id] = null;
        }
      }
      if (!cancelled) setParticipantImageUrls((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [conversations]);

  const refreshInboxAndMaybeMessages = useCallback(
    async (opts?: { refreshMessagesForConversationId?: string | null }) => {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      try {
        const inbox = await getInboxConversations(session.userId);
        setConversations(
          inbox.map((c) => ({
            id: c.id,
            participantId: c.participantId,
            participantName: c.participantName,
            serviceType: c.serviceType,
            lastMessage: c.lastMessage,
            lastMessageTime: new Date(c.lastMessageTime),
            unreadCount: c.unreadCount,
          }))
        );

        const convoId = opts?.refreshMessagesForConversationId ?? null;
        if (convoId) {
          const dto = await getConversationMessages(convoId);
          const convo = inbox.find((c) => c.id === convoId);
          const participantName = convo?.participantName || 'User';
          setMessages(
            dto.map((m) => ({
              id: m.id,
              conversationId: m.conversationId,
              senderId: m.senderId,
              recipientId: m.recipientId,
              createdAt: m.createdAt,
              text: m.text,
              senderName: m.senderId === session.userId ? 'You' : participantName,
            }))
          );
        }
      } finally {
        isRefreshingRef.current = false;
      }
    },
    [session.userId]
  );

  // Light polling so both sides see updates without a full refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      const active = lastSelectedRef.current;
      refreshInboxAndMaybeMessages({ refreshMessagesForConversationId: active });
    }, 2500);
    return () => clearInterval(interval);
  }, [refreshInboxAndMaybeMessages]);

  const handleConversationSelect = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    lastSelectedRef.current = conversationId;
    setDraftParticipantId(null);
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      try {
        const dto = await getConversationMessages(conversationId);
        setMessages(
          dto.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            recipientId: m.recipientId,
            createdAt: m.createdAt,
            text: m.text,
            senderName: m.senderId === session.userId ? 'You' : conversation.participantName,
          }))
        );
      } catch {
        setMessages([]);
      }
    }
  };

  // If /dashboard/messages?userId=<otherUserId> is provided, auto-open that conversation (or open a draft).
  useEffect(() => {
    const targetUserId = (searchParams?.get('userId') || '').trim();
    if (!targetUserId) return;

    const existing = conversations.find((c) => c.participantId === targetUserId);
    if (existing) {
      if (selectedConversationId !== existing.id) handleConversationSelect(existing.id);
      return;
    }

    // No existing conversation: open a draft chat UI; do NOT create a conversation until first send.
    if (draftParticipantId !== targetUserId) {
      setSelectedConversationId(null);
      setMessages([]);
      setDraftParticipantId(targetUserId);
      setDraftParticipantName('User');
      setDraftParticipantImageUrl(null);

      (async () => {
        try {
          const { displayName, profileImageUrl } = await getUserDisplayInfoById(targetUserId);
          setDraftParticipantName(displayName || 'User');
          setDraftParticipantImageUrl(profileImageUrl ?? null);
        } catch {
          // ignore; keep fallback UI
        }
      })();
    }
  }, [searchParams, conversations, selectedConversationId, draftParticipantId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const text = inputValue.trim();
    if (containsPersonalContactInfo(text)) {
      setSendError(PERSONAL_CONTACT_INFO_BLOCK_MESSAGE);
      return;
    }
    const recipientId = selectedConversationId
      ? conversations.find((c) => c.id === selectedConversationId)?.participantId
      : draftParticipantId;

    if (!recipientId) return;

    setSendError(null);

    // Optimistic UI append
    const optimisticId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimisticCreatedAt = new Date().toISOString();
    const optimisticConversationId = selectedConversationId || `pending_${recipientId}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId: optimisticConversationId,
      senderId: session.userId,
      recipientId,
      createdAt: optimisticCreatedAt,
      text,
      senderName: 'You',
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputValue('');

    try {
      const res = await sendMessage({ senderId: session.userId, recipientId, text });
      const actualConversationId = res.conversationId;

      if (!selectedConversationId) {
        setSelectedConversationId(actualConversationId);
        lastSelectedRef.current = actualConversationId;
        setDraftParticipantId(null);
      }

      // Revalidate inbox + messages so both users converge on the same persisted state.
      await refreshInboxAndMaybeMessages({ refreshMessagesForConversationId: actualConversationId });
    } catch (err: any) {
      // Remove the optimistic message so blocked sends don't linger (draft chats won't auto-reconcile).
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInputValue(text);
      const msg =
        (typeof err?.message === 'string' && err.message.trim()) ||
        'Message could not be sent. Please try again.';
      setSendError(msg);
    }
  };

  const selectedConversation = selectedConversationId
    ? conversations.find(c => c.id === selectedConversationId)
    : null;

  const activeParticipantName = selectedConversation
    ? selectedConversation.participantName
    : draftParticipantId
      ? draftParticipantName
      : null;
  const activeParticipantImageUrl = selectedConversation
    ? participantImageUrls[selectedConversation.participantId]
    : draftParticipantId
      ? draftParticipantImageUrl
      : null;

  return (
    <div className="h-[calc(100vh-16rem)] flex rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
      {/* Left Panel - Conversations List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
          <p className="mt-1 text-sm text-gray-500">
            {userRole === 'student' ? 'Chat with your tutors and counselors' : 'Chat with your students'}
          </p>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {conversations.map((conversation) => {
                const isSelected = selectedConversationId === conversation.id;
                const unreadCount = Number(conversation.unreadCount ?? 0) || 0;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                    className={`w-full px-6 py-4 text-left transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-gray-50 border-[#0088CB]'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={conversation.participantName}
                        imageUrl={participantImageUrls[conversation.participantId]}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate text-gray-900">
                            {conversation.participantName}
                          </h3>
                          {unreadCount > 0 && !isSelected && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0088CB] text-white text-xs font-medium flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          {conversation.serviceType}
                        </p>
                        <p className={`mt-2 text-sm truncate ${
                          isSelected ? 'text-gray-700' : 'text-gray-600'
                        }`}>
                          {conversation.lastMessage}
                        </p>
                      </div>
                    </div>
                    <p className={`mt-2 text-xs ${
                      isSelected ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {formatTime(conversation.lastMessageTime)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedConversation || draftParticipantId ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar name={activeParticipantName || 'User'} imageUrl={activeParticipantImageUrl} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {activeParticipantName || 'User'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedConversation ? selectedConversation.serviceType : 'New conversation'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isOwnMessage = message.senderId === session.userId;
                  const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                  const showTime = index === messages.length - 1 || 
                    messages[index + 1].senderId !== message.senderId ||
                    new Date(messages[index + 1].createdAt).getTime() - new Date(message.createdAt).getTime() > 5 * 60 * 1000; // 5 minutes

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                        showAvatar ? 'mt-6' : 'mt-1'
                      }`}
                    >
                      {!isOwnMessage && showAvatar && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0088CB] flex items-center justify-center text-white text-xs font-semibold mr-3">
                          {message.senderName.charAt(0)}
                        </div>
                      )}
                      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        {showAvatar && (
                          <span className={`text-xs font-medium mb-1 ${
                            isOwnMessage ? 'text-gray-600' : 'text-gray-500'
                          }`}>
                            {isOwnMessage ? 'You' : message.senderName}
                          </span>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isOwnMessage
                              ? 'bg-[#0088CB] text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <p className={`text-sm ${isOwnMessage ? 'text-white' : 'text-gray-900'}`}>
                            {message.text}
                          </p>
                        </div>
                        {showTime && (
                          <span className={`text-xs mt-1 ${
                            isOwnMessage ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            {formatMessageTime(new Date(message.createdAt))}
                          </span>
                        )}
                      </div>
                      {isOwnMessage && showAvatar && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-semibold ml-3">
                          {session.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (sendError) setSendError(null);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (e.shiftKey) return;
                      if ((e.nativeEvent as unknown as { isComposing?: boolean } | null)?.isComposing) return;
                      e.preventDefault();
                      void handleSendMessage();
                    }}
                    placeholder="Type a message…"
                    rows={1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent resize-none text-sm overflow-y-auto"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                  {sendError && (
                    <p className="mt-2 text-sm text-red-600">
                      {sendError}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                    inputValue.trim()
                      ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Select a conversation to start chatting</h3>
              <p className="mt-2 text-sm text-gray-500">
                Choose a conversation from the list to view and send messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
