'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TicketListItem = {
  id: string;
  userId: string;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  user?: {
    id: string;
    name: string;
    email: string;
    profilePhotoUrl?: string | null;
  } | null;
};

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

export default function SupportInboxPage() {
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
      const resp = await fetch('/api/support/tickets?admin=1');
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
      setThread((data?.thread as Thread) ?? null);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages?.length]);

  async function closeTicket() {
    if (!selected?.id) return;
    await fetch(`/api/support/tickets/${encodeURIComponent(selected.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    await refresh();
    await refreshSelectedThread(selected.id);
  }

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

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    refreshSelectedThread(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Support</h1>
        <p className="mt-2 text-sm text-gray-600">View and respond to support tickets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Threads */}
        <div className="lg:col-span-1 overflow-hidden rounded-lg bg-white shadow border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Tickets</h2>
            <button
              type="button"
              onClick={refresh}
              className="text-xs text-[#0088CB] hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Loading…</div>
            ) : tickets.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No support conversations yet.</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {tickets.map((t) => {
                  const isActive = t.id === selectedId;
                  const label = statusLabel(t.status);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                          isActive ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {t.user?.name || t.userId}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{t.user?.email || ''}</p>
                            <p className="mt-1 text-xs text-gray-700 truncate">{t.subject}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Updated {formatTime(t.lastMessageAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusPillClasses(label)}`}>
                              {label}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {t.messageCount} msg
                            </span>
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

        {/* Right: Thread view */}
        <div className="lg:col-span-2 overflow-hidden rounded-lg bg-white shadow border border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {selected ? (selected.user?.name || selected.userId) : 'Select a ticket'}
              </h2>
              {selected?.user?.email && <p className="text-xs text-gray-500">{selected.user.email}</p>}
              {selected?.subject && <p className="text-xs text-gray-700 mt-1">{selected.subject}</p>}
            </div>
            {selected && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeTicket}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50"
                >
                  Close
                </button>
              </div>
            )}
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
                const isAdmin = m.senderRole === 'admin';
                return (
                  <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                      isAdmin ? 'bg-[#0088CB] text-white' : 'bg-white text-gray-800 border border-gray-200'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      <p className={`mt-1 text-[11px] ${isAdmin ? 'text-blue-100/90' : 'text-gray-400'}`}>
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
                  placeholder="Reply to user…"
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



