'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TicketListItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  updatedAt?: string;
  unreadForUser?: number;
  lastMessagePreview?: string;
  lastMessageSenderRole?: string;
};

type Thread = {
  ticket: {
    id: string;
    userId: string;
    role: string;
    subject: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    unreadForUser?: number;
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

function statusLabel(status: string): 'Waiting on Admin' | 'Waiting on You' | 'Resolved' | 'Closed' {
  const s = (status || '').toLowerCase();
  if (s === 'resolved') return 'Resolved';
  if (s === 'closed') return 'Closed';
  if (s === 'admin_replied') return 'Waiting on You';
  return 'Waiting on Admin';
}

function statusPillClasses(label: ReturnType<typeof statusLabel>): string {
  if (label === 'Closed') return 'bg-gray-100 text-gray-700';
  if (label === 'Resolved') return 'bg-emerald-100 text-emerald-800';
  if (label === 'Waiting on You') return 'bg-blue-100 text-blue-800';
  return 'bg-amber-100 text-amber-900';
}

export default function MySupportTicketsClient() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

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

  async function refreshSelectedThread(ticketId: string): Promise<void> {
    try {
      const resp = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      const th = (data?.thread as Thread) ?? null;
      setThread(th);
      // Server clears unread count when the ticket is opened.
      await refresh();
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

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: Ticket list */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Tickets</h2>
              <p className="mt-1 text-xs text-gray-500">
                {isLoading ? 'Loading…' : `${tickets.length} total`}
              </p>
            </div>
            <button type="button" onClick={refresh} className="text-xs text-[#0088CB] hover:underline">
              Refresh
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-5 text-sm text-gray-500">Loading…</div>
            ) : tickets.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">
                You don’t have any tickets yet.
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {tickets.map((t) => {
                  const isActive = t.id === selectedId;
                  const label = statusLabel(t.status);
                  const unread = t.unreadForUser ?? 0;
                  const preview = (t.lastMessagePreview || '').trim() || 'No messages yet.';
                  const updated = t.lastMessageAt || t.updatedAt || t.createdAt;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={[
                        'w-full text-left rounded-xl border p-4 transition',
                        'hover:bg-gray-50 hover:border-gray-300',
                        'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/30 focus:border-[#0088CB]/40',
                        isActive ? 'bg-blue-50/60 border-[#0088CB]/30 ring-1 ring-[#0088CB]/20' : 'bg-white border-gray-200',
                      ].join(' ')}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.subject}</p>
                          <p className="mt-1 text-xs text-gray-500 truncate">{preview}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusPillClasses(label)}`}>
                            {label}
                          </span>
                          <p className="text-[11px] text-gray-500 whitespace-nowrap">{formatTime(updated)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[12px] text-gray-600">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                            {t.messageCount} messages
                          </span>
                          {unread > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#0088CB] px-2 py-0.5 text-white font-semibold">
                              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/20 text-[11px]">
                                {unread}
                              </span>
                              <span className="text-[11px]">unread</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Conversation */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 flex flex-col min-h-[70vh]">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">Conversation</h2>
                {selected && (
                  <>
                    <p className="mt-2 text-base font-semibold text-gray-900 truncate">{selected.subject}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Updated {formatTime(selected.lastMessageAt || selected.updatedAt || selected.createdAt)}
                    </p>
                  </>
                )}
              </div>
              {selected && (
                <span
                  className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${statusPillClasses(statusLabel(selected.status))}`}
                >
                  {statusLabel(selected.status)}
                </span>
              )}
            </div>
          </div>

          {!selected ? (
            <div className="flex-1 bg-gray-50 p-6 flex items-center justify-center">
              <div className="w-full max-w-md rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
                <p className="text-sm font-semibold text-gray-900">Support inbox</p>
                <p className="mt-1 text-sm text-gray-600">Your ticket conversation will appear here.</p>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 p-5 bg-gray-50 overflow-y-auto space-y-4">
                {!thread ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : thread.messages.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
                    No messages yet.
                  </div>
                ) : (
                  thread.messages.map((m) => {
                    const isUser = m.senderRole !== 'admin';
                    const sender = isUser ? 'You' : 'IvyWay Support';
                    return (
                      <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[86%]">
                          <div
                            className={[
                              'rounded-2xl px-4 py-2.5 shadow-sm',
                              isUser
                                ? 'bg-[#0088CB] text-white'
                                : 'bg-white text-gray-800 border border-gray-200',
                            ].join(' ')}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-6">{m.message}</p>
                          </div>
                          <div
                            className={[
                              'mt-1 flex items-center gap-2 text-[11px]',
                              isUser ? 'justify-end text-blue-900/50' : 'justify-start text-gray-400',
                            ].join(' ')}
                          >
                            <span className="font-medium">{sender}</span>
                            <span className="text-gray-300">•</span>
                            <span>{formatTime(m.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendReply} className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                    disabled={isSending || (selected.status || '').toLowerCase() === 'closed'}
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#0088CB] text-white rounded-full hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!reply.trim() || isSending || (selected.status || '').toLowerCase() === 'closed'}
                  >
                    Send
                  </button>
                </div>
                {((selected.status || '').toLowerCase() === 'closed') && (
                  <p className="mt-2 text-xs text-gray-500">This ticket is closed.</p>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


