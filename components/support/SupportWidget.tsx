'use client';

import { useMemo, useState } from 'react';

import SupportBubble from './SupportBubble';
import SupportChatPanel from './SupportChatPanel';
import type { SupportQuickAction } from './SupportQuickActions';
import type { SupportChatMessage } from './SupportMessageList';

import {
  buildTicketBody,
  generateTicketSubject,
  isAffirmative,
  matchFaq,
  shouldEscalateToHuman,
  type SupportAIDashboardRole,
} from '@/lib/support/aiSupport';

function newId(prefix: string): string {
  try {
    // Browser crypto
    const uuid = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${uuid}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

type PendingTicketOffer = {
  suggestedSubject: string;
  matchedFaqId?: string | null;
};

export default function SupportWidget(props: {
  role: SupportAIDashboardRole;
}) {
  const { role } = props;

  const quickActions = useMemo<SupportQuickAction[]>(
    () => [
      { id: 'qa_book', label: 'How do I book a session', message: 'How do I book a session?' },
      { id: 'qa_join', label: 'How do I join my session', message: 'How do I join my session?' },
      { id: 'qa_pay', label: 'How do payments work', message: 'How do payments work?' },
      { id: 'qa_human', label: 'I need human help', message: 'I need human help.' },
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [pendingTicket, setPendingTicket] = useState<PendingTicketOffer | null>(null);

  async function createTicketFromTranscript(args: {
    subject: string;
    transcript: Array<{ role: 'user' | 'assistant'; text: string }>;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const fd = new FormData();
      fd.append('subject', args.subject);
      fd.append('message', buildTicketBody({ role, transcript: args.transcript }));

      const resp = await fetch('/api/support-ticket', { method: 'POST', body: fd });
      if (!resp.ok) {
        return { ok: false, error: 'Unable to send message.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to send message.' };
    }
  }

  async function handleUserSend(raw: string) {
    const text = raw.trim();
    if (!text || isBusy) return;

    setIsBusy(true);
    setDraft('');

    const userMsg: SupportChatMessage = { id: newId('m'), role: 'user', text };
    const nextTranscript = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));
    setMessages((cur) => [...cur, userMsg]);

    // Ticket confirmation step
    if (pendingTicket && isAffirmative(text)) {
      const creating: SupportChatMessage = {
        id: newId('m'),
        role: 'assistant',
        text: 'Creating your support ticket now…',
      };
      setMessages((cur) => [...cur, creating]);

      const result = await createTicketFromTranscript({
        subject: pendingTicket.suggestedSubject,
        transcript: [...nextTranscript, { role: 'assistant', text: creating.text }],
      });

      if (!result.ok) {
        setMessages((cur) => [
          ...cur,
          {
            id: newId('m'),
            role: 'assistant',
            text: `I couldn’t create the ticket automatically. ${result.error}\n\nYou can also submit one here: /dashboard/support`,
          },
        ]);
        setPendingTicket(null);
        setIsBusy(false);
        return;
      }

      setMessages((cur) => [
        ...cur,
        {
          id: newId('m'),
          role: 'assistant',
          kind: 'ticket_created',
          text: 'Your support ticket has been created. Our team will reply as soon as possible.',
        },
      ]);
      setPendingTicket(null);
      setIsBusy(false);
      return;
    }

    // If user asked for human help (or is unsatisfied)
    if (shouldEscalateToHuman(text)) {
      const suggestedSubject = generateTicketSubject({
        role,
        lastUserMessage: text,
        matchedFaqId: null,
      });
      setPendingTicket({ suggestedSubject });
      setMessages((cur) => [
        ...cur,
        {
          id: newId('m'),
          role: 'assistant',
          text: 'I can help create a support ticket for a human team member. Would you like me to do that?',
        },
      ]);
      setIsBusy(false);
      return;
    }

    const match = matchFaq({ message: text, role });
    if (match) {
      setMessages((cur) => [
        ...cur,
        { id: newId('m'), role: 'assistant', text: match.entry.answer(role) },
      ]);
      setIsBusy(false);
      return;
    }

    // Fallback: offer ticket
    const suggestedSubject = generateTicketSubject({
      role,
      lastUserMessage: text,
      matchedFaqId: null,
    });
    setPendingTicket({ suggestedSubject });
    setMessages((cur) => [
      ...cur,
      {
        id: newId('m'),
        role: 'assistant',
        text: 'I am not fully sure about that. Would you like me to create a support ticket for a human team member?',
      },
    ]);
    setIsBusy(false);
  }

  return (
    <>
      <SupportChatPanel
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => handleUserSend(draft)}
        quickActions={quickActions}
        onPickQuickAction={(m) => {
          setOpen(true);
          handleUserSend(m);
        }}
        isBusy={isBusy}
      />
      <SupportBubble isOpen={open} onToggle={() => setOpen((v) => !v)} />
    </>
  );
}

