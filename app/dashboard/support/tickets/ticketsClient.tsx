'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TicketListItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
};

type TicketSummary = {
  lastMessageAt: string;
  preview: string;
  unreadFromAdmin: number;
};

type Thread = {
  ticket: {
    id: string;
    userId: string;
    role: string;
    subject: string;
    status: string;
    createdAt: string;
  };
  messages: Array<{
    id: string;
    ticketId: string;
    senderId: string;
    senderRole: string;
    message: string;
    createdAt: string;
  }>;
};

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function statusLabel(status: string): 'Open' | 'Awaiting Response' | 'Resolved' {
  if (status === 'closed') return 'Resolved';
  if (status === 'admin_replied') return 'Awaiting Response';
  return 'Open';
}

function statusPillClasses(label: ReturnType<typeof statusLabel>): string {
  if (label === 'Resolved') return 'bg-gray-100 text-gray-700';
  if (label === 'Awaiting Response') return 'bg-blue-100 text-blue-800';
  return 'bg-green-100 text-green-800';
}

function normalizePreview(text: string): string {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No messages yet.';
  return cleaned.length > 80 ? `${cleaned.slice(0, 80)}…` : cleaned;
}

function lastSeenKey(ticketId: string): string {
  return `ivyway_support_ticket_last_seen_${ticketId}`;
}

function getLastSeenAt(ticketId: string): string | null {
  try {
    return localStorage.getItem(lastSeenKey(ticketId));
  } catch {
    return null;
  }
}

function setLastSeenAt(ticketId: string, iso: string): void {
  try {
    localStorage.setItem(lastSeenKey(ticketId), iso);
  } catch {
    // ignore
  }
}

export default function MySupportTicketsClient() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const [summaries, setSummaries] = useState<Record<string, TicketSummary>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => tickets.find(t => t.id === selectedId) ?? null,
    [tickets, selectedId]
  );

  async function refresh(): Promise<void> {
    try {
      const resp = await fetch('/api/support/tickets');
      if (!resp.ok) return;
      const data = await resp.json();
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  }

  async function hydrateSummaries(nextTickets: TicketListItem[]): Promise<void> {
    const toFetch = nextTickets.filter((t) => summaries[t.id]?.lastMessageAt !== t.lastMessageAt);
    if (toFetch.length === 0) return;

    await Promise.all(
      toFetch.map(async (t) => {
        try {
          const resp = await fetch(`/api/support/tickets/${encodeURIComponent(t.id)}`);
          if (!resp.ok) return;
          const data = await resp.json();
          const th = (data?.thread as Thread) ?? null;
          if (!th) return;

          const ms = Array.isArray(th.messages) ? th.messages : [];
          const lastMessage = ms.length ? ms[ms.length - 1] : null;
          const preview = normalizePreview(lastMessage?.message || '');

          const lastSeenAt = getLastSeenAt(t.id);
          const unreadFromAdmin = ms.filter((m) => m.senderRole === 'admin' && (!lastSeenAt || m.createdAt > lastSeenAt)).length;

          setSummaries((prev) => ({
            ...prev,
            [t.id]: {
              lastMessageAt: t.lastMessageAt,
              preview,
              unreadFromAdmin,
            },
          }));
        } catch {
          // ignore
        }
      })
    );
  }

  async function refreshSelectedThread(ticketId: string): Promise<void> {
    try {
      const resp = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      const th = (data?.thread as Thread) ?? null;
      setThread(th);

      // Mark ticket as "seen" when opened, so the unread badge behaves like an inbox.
      const ms = Array.isArray(th?.messages) ? th!.messages : [];
      const lastAdmin = [...ms].reverse().find((m) => m.senderRole === 'admin');
      if (lastAdmin?.createdAt) {
        setLastSeenAt(ticketId, lastAdmin.createdAt);
        setSummaries((prev) => {
          const cur = prev[ticketId];
          return {
            ...prev,
            [ticketId]: {
              lastMessageAt: cur?.lastMessageAt ?? (selected?.lastMessageAt ?? ''),
              preview: cur?.preview ?? normalizePreview(ms.length ? ms[ms.length - 1]?.message || '' : ''),
              unreadFromAdmin: 0,
            },
          };
        });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 12000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isLoading && tickets.length) {
      hydrateSummaries(tickets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, tickets]);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    refreshSelectedThread(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages?.length]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !selected?.id || isSending) return;
    setIsSending(true);
    setReply('');
    try {
      await fetch(`/api/support/tickets/${encodeURIComponent(selected.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      await refresh();
      await refreshSelectedThread(selected.id);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Support Tickets</h1>
        <p className="mt-2 text-sm text-gray-600">View replies from the IvyWay team and send follow-ups.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 overflow-hidden rounded-lg bg-white shadow border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Tickets</h2>
            <button type="button" onClick={refresh} className="text-xs text-[#0088CB] hover:underline">
              Refresh
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Loading…</div>
            ) : tickets.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                You don’t have any tickets yet. Create one from the Support Center.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {tickets.map((t) => {
                  const isActive = t.id === selectedId;
                  const label = statusLabel(t.status);
                  const unread = summaries[t.id]?.unreadFromAdmin ?? 0;
                  const preview = summaries[t.id]?.preview ?? 'Loading…';
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${isActive ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                            <p className="mt-1 text-xs text-gray-500 truncate">{preview}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full ${statusPillClasses(label)}`}
                            >
                              {label}
                            </span>
                            {unread > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#0088CB] text-white text-[11px] font-semibold">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 overflow-hidden rounded-lg bg-white shadow border border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">
              {selected ? selected.subject : 'Select a ticket'}
            </h2>
          </div>

          <div ref={scrollRef} className="flex-1 p-4 bg-gray-50 overflow-y-auto space-y-3">
            {!selected ? (
              <div className="text-sm text-gray-500">Pick a ticket on the left.</div>
            ) : !thread ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : thread.messages.length === 0 ? (
              <div className="text-sm text-gray-500">No messages yet.</div>
            ) : (
              thread.messages.map((m) => {
                const isUser = m.senderRole !== 'admin';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                        isUser ? 'bg-[#0088CB] text-white' : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      <p className={`mt-1 text-[11px] ${isUser ? 'text-blue-100/90' : 'text-gray-400'}`}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selected && (
            <form onSubmit={sendReply} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Send a follow-up…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                  disabled={isSending || selected.status === 'closed'}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0088CB] text-white rounded-md hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!reply.trim() || isSending || selected.status === 'closed'}
                >
                  Send
                </button>
              </div>
              {selected.status === 'closed' && (
                <p className="mt-2 text-xs text-gray-500">This ticket is closed.</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


