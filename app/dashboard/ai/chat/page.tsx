'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, CalendarDays, Eye, HelpCircle, Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';

import './chat.css';
import ChatInput from '@/components/ChatInput';
import {
  containsPersonalContactInfo,
  PERSONAL_CONTACT_INFO_BLOCK_MESSAGE,
} from '@/lib/messages/contentFilter';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AssistantActionId = 'visual_explain' | 'another_question' | 'explain_differently' | 'add_to_planner' | 'quiz_me';
type AssistantFeedback = 'up' | 'down' | null;

type AssistantActionContext = {
  userMessage: string;
  assistantMessage: string;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function getLastAssistantMessage(messages: ChatMessage[]): { msg: ChatMessage; idx: number } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === 'assistant' && m.content.trim()) return { msg: m, idx: i };
  }
  return null;
}

function getUserMessageBefore(messages: ChatMessage[], idx: number): string {
  for (let i = idx - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === 'user' && m.content.trim()) return m.content;
  }
  return '';
}

function cleanupAssistantText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1');
}

function renderAssistantParagraphs(text: string) {
  const normalized = cleanupAssistantText(text).trimEnd();
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return paragraphs.map((p, idx) => {
    const lines = p.split('\n');
    return (
      <p key={idx}>
        {lines.map((line, lineIdx) => (
          <React.Fragment key={lineIdx}>
            {line}
            {lineIdx < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function buildAssistantActionInstruction(actionId: AssistantActionId): string {
  switch (actionId) {
    case 'visual_explain':
      return 'Visual Explain';
    case 'another_question':
      return 'Create a similar question based on this';
    case 'explain_differently':
      return 'Explain this in a different way';
    case 'quiz_me':
      return 'Create a short quiz based on this';
    case 'add_to_planner':
      // No AI request needed; handled locally.
      return '';
  }
}

function buildAssistantActionPrompt(actionId: AssistantActionId, ctx: AssistantActionContext): string {
  if (actionId === 'visual_explain') {
    return [
      'Explain this step-by-step using a visual format.',
      '',
      'Use:',
      '- bullet points',
      '- spacing',
      '- arrows (→)',
      '- simple diagrams using text',
      '- labeled steps',
      '',
      'Make it feel visual and easy to scan, not like a paragraph.',
      '',
      'Content:',
      ctx.assistantMessage.trim(),
      '',
    ].join('\n');
  }

  const instruction = buildAssistantActionInstruction(actionId).trim();
  if (!instruction) return '';
  return `${instruction}:\n\n${ctx.assistantMessage.trim()}`;
}

function tryAddToPlannerPlaceholder(item: { userMessage: string; assistantMessage: string }) {
  try {
    if (typeof window === 'undefined') return { ok: false as const };
    const key = 'ivyway_planner_items_placeholder_v1';
    const raw = window.localStorage.getItem(key);
    const existing = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(existing) ? existing : [];
    list.push({
      id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      userMessage: item.userMessage,
      assistantMessage: item.assistantMessage,
    });
    window.localStorage.setItem(key, JSON.stringify(list));
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

const ASSISTANT_ACTIONS_BY_ID: Record<AssistantActionId, { label: string; icon: LucideIcon }> = {
  visual_explain: { label: 'Visual Explain', icon: Eye },
  another_question: { label: 'Another question', icon: HelpCircle },
  explain_differently: { label: 'Explain differently', icon: Lightbulb },
  add_to_planner: { label: 'Add to my planner', icon: CalendarDays },
  quiz_me: { label: 'Quiz me on this', icon: BookOpen },
};

const ASSISTANT_ACTION_ROWS: AssistantActionId[][] = [
  ['visual_explain', 'another_question', 'explain_differently'],
  ['add_to_planner', 'quiz_me'],
];

const ChatMessageRow = React.memo(function ChatMessageRow(props: {
  message: ChatMessage;
  assistantContext?: AssistantActionContext;
  isDisabled?: boolean;
  onAssistantAction?: (actionId: AssistantActionId, ctx: AssistantActionContext) => void;
  feedback?: AssistantFeedback;
  onFeedback?: (messageId: string, value: Exclude<AssistantFeedback, null>) => void;
  showFeedbackThanks?: boolean;
}) {
  const { message: m, assistantContext, isDisabled, onAssistantAction, feedback, onFeedback, showFeedbackThanks } = props;
  const isUser = m.role === 'user';
  const canShowActions = !isUser && Boolean(assistantContext) && Boolean(m.content.trim());
  const isFeedbackLocked = feedback !== null;
  return (
    <div
      className={classNames('message-row', isUser ? 'message-row--user' : 'message-row--assistant')}
      data-message-role={m.role}
    >
      {isUser ? (
        <div className={classNames('message--user')}>{m.content}</div>
      ) : (
        <div className="ai-message">
          <div className="assistant-message">{renderAssistantParagraphs(m.content)}</div>
          {canShowActions ? (
            <div className="assistant-interactions" aria-label="Assistant interactions">
              <div className="assistant-actions" aria-label="Message actions">
                {ASSISTANT_ACTION_ROWS.map((row, rowIdx) => (
                  <div className="assistant-actions__row" key={rowIdx}>
                    {row.map((actionId) => {
                      const model = ASSISTANT_ACTIONS_BY_ID[actionId];
                      const Icon = model.icon;
                      return (
                        <button
                          key={actionId}
                          type="button"
                          className="assistant-action"
                          disabled={Boolean(isDisabled)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onAssistantAction?.(actionId, assistantContext as AssistantActionContext)}
                        >
                          <Icon className="assistant-action__icon" aria-hidden="true" />
                          <span className="assistant-action__text">{model.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="message-feedback" aria-label="Helpful feedback">
                <span className="message-feedback__label">Helpful?</span>
                <button
                  type="button"
                  className="message-feedback__btn"
                  aria-label="Mark as helpful"
                  aria-pressed={feedback === 'up'}
                  data-selected={feedback === 'up'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onFeedback?.(m.id, 'up')}
                  disabled={Boolean(isDisabled) || isFeedbackLocked}
                >
                  <ThumbsUp className="message-feedback__icon" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="message-feedback__btn"
                  aria-label="Mark as not helpful"
                  aria-pressed={feedback === 'down'}
                  data-selected={feedback === 'down'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onFeedback?.(m.id, 'down')}
                  disabled={Boolean(isDisabled) || isFeedbackLocked}
                >
                  <ThumbsDown className="message-feedback__icon" aria-hidden="true" />
                </button>
              </div>
              {showFeedbackThanks ? <div className="message-feedback__thanks">Thank you for your feedback!</div> : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});

export default function IvyWayAIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const isSendingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<Record<string, Exclude<AssistantFeedback, null>>>({});
  const [feedbackThanksByMessageId, setFeedbackThanksByMessageId] = useState<Record<string, boolean>>({});
  const feedbackThanksTimersRef = useRef<Record<string, number>>({});

  const router = useRouter();
  const searchParams = useSearchParams();
  const didAutoSendRef = useRef(false);

  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = input.trim().length > 0 && !isSending;

  const sendLabel = useMemo(() => (isSending ? 'Sending' : 'Send'), [isSending]);

  const sendMessage = useCallback(async (args: { prompt: string; displayText?: string }) => {
    const trimmed = args.prompt.trim();
    if (!trimmed) return;
    if (isSendingRef.current) return;

    if (containsPersonalContactInfo(trimmed)) {
      setSendError(PERSONAL_CONTACT_INFO_BLOCK_MESSAGE);
      return;
    }

    const displayText = (args.displayText ?? trimmed).trim() || trimmed;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayText,
    };

    const assistantMessageId = crypto.randomUUID();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    isSendingRef.current = true;
    setIsSending(true);
    setInput('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response; handled below via text fallback when needed.
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const messageFromJson =
          typeof (data as { message?: unknown } | null)?.message === 'string'
            ? (data as { message: string }).message
            : '';
        const assistantText = messageFromJson || errText || 'Something went wrong.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: cleanupAssistantText(assistantText) }
              : m
          )
        );
        return;
      }

      const message =
        typeof (data as { message?: unknown } | null)?.message === 'string'
          ? (data as { message: string }).message
          : '';
      const finalText = cleanupAssistantText(message || 'Something went wrong.');
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessageId ? { ...m, content: finalText } : m))
      );
    } catch (e) {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Network error. Please try again.',
      };
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last?.id === assistantMessageId) {
          return [...prev.slice(0, -1), { ...last, content: assistantMessage.content }];
        }
        const idx = prev.findIndex((m) => m.id === assistantMessageId);
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], content: assistantMessage.content };
        return next;
      });
      console.error('AI chat request error', e);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      const timers = feedbackThanksTimersRef.current;
      Object.values(timers).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      feedbackThanksTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    const messageFromQuery = searchParams.get('message')?.trim() ?? '';
    if (!messageFromQuery) return;
    if (didAutoSendRef.current) return;

    didAutoSendRef.current = true;
    router.replace('/dashboard/ai/chat', { scroll: false });
    void sendMessage({ prompt: messageFromQuery, displayText: messageFromQuery });
  }, [router, searchParams, sendMessage]);

  const handleInputChange = useCallback((value: string, el: HTMLTextAreaElement) => {
    setInput(value);
    if (sendError) setSendError(null);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [sendError]);

  const handleSend = useCallback(
    (raw: string) => {
      void sendMessage({ prompt: raw, displayText: raw });
    },
    [sendMessage]
  );

  const handleAssistantAction = useCallback(
    (actionId: AssistantActionId, ctxFromClick: AssistantActionContext) => {
      if (isSendingRef.current) return;

      const lastAssistant = getLastAssistantMessage(messagesRef.current);

      if (actionId === 'add_to_planner') {
        const plannerCtx =
          ctxFromClick.assistantMessage?.trim()
            ? ctxFromClick
            : lastAssistant
              ? {
                  userMessage: getUserMessageBefore(messagesRef.current, lastAssistant.idx),
                  assistantMessage: lastAssistant.msg.content,
                }
              : null;
        if (!plannerCtx) return;

        const result = tryAddToPlannerPlaceholder(plannerCtx);
        const feedback: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.ok
            ? 'Saved to your planner (placeholder).'
            : 'Could not save to planner (placeholder).',
        };
        setMessages((prev) => [...prev, feedback]);
        return;
      }

      if (!lastAssistant) return;
      const ctx: AssistantActionContext = {
        userMessage: getUserMessageBefore(messagesRef.current, lastAssistant.idx),
        assistantMessage: lastAssistant.msg.content,
      };

      const prompt = buildAssistantActionPrompt(actionId, ctx);
      if (!prompt.trim()) return;

      const displayText = buildAssistantActionInstruction(actionId);
      void sendMessage({ prompt, displayText: displayText || prompt });
    },
    [sendMessage]
  );

  const handleFeedback = useCallback((messageId: string, value: Exclude<AssistantFeedback, null>) => {
    setFeedbackByMessageId((prev) => {
      if (prev[messageId]) return prev; // lock after first click
      return { ...prev, [messageId]: value };
    });

    setFeedbackThanksByMessageId((prev) => ({ ...prev, [messageId]: true }));
    const existingTimer = feedbackThanksTimersRef.current[messageId];
    if (existingTimer) window.clearTimeout(existingTimer);
    feedbackThanksTimersRef.current[messageId] = window.setTimeout(() => {
      setFeedbackThanksByMessageId((prev) => {
        if (!prev[messageId]) return prev;
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      delete feedbackThanksTimersRef.current[messageId];
    }, 2200);
  }, []);

  return (
    <div className="chat-page chat-page--fullbleed">
      <div className="chat-messages">
        {messages.map((m, idx) => {
          const assistantContext: AssistantActionContext | undefined =
            m.role === 'assistant'
              ? {
                  userMessage: idx > 0 && messages[idx - 1]?.role === 'user' ? messages[idx - 1].content : '',
                  assistantMessage: m.content,
                }
              : undefined;
          return (
            <ChatMessageRow
              key={m.id}
              message={m}
              assistantContext={assistantContext}
              isDisabled={isSending || !m.content.trim()}
              onAssistantAction={handleAssistantAction}
              feedback={feedbackByMessageId[m.id] ?? null}
              onFeedback={handleFeedback}
              showFeedbackThanks={Boolean(feedbackThanksByMessageId[m.id])}
            />
          );
        })}
        <div ref={endRef} />
      </div>

      <ChatInput
        inputId={inputId}
        input={input}
        onInputChange={handleInputChange}
        canSend={canSend}
        sendLabel={sendLabel}
        onSend={handleSend}
        fileInputRef={fileInputRef}
        error={sendError}
      />
    </div>
  );
}

