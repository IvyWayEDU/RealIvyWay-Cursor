'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TicketUser = {
  id: string;
  name: string;
  email: string;
  profilePhotoUrl?: string | null;
};

type TicketListItem = {
  id: string;
  userId: string;
  role: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  lastMessageAt: string;
  messageCount: number;
  unreadForAdmin?: number;
  unreadForUser?: number;
  user?: TicketUser | null;
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
    resolvedAt?: string | null;
    unreadForAdmin?: number;
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

type StatusFilter =
  | 'all'
  | 'open'
  | 'pending'
  | 'admin_replied'
  | 'resolved'
  | 'closed'
  | 'unread';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function uiStatusLabel(status: string): string {
  if (status === 'resolved') return 'Resolved';
  if (status === 'closed') return 'Closed';
  if (status === 'admin_replied') return 'Waiting on User';
  // open + pending (and unknown defaults)
  return 'Waiting on Admin';
}

function statusPillClasses(label: string): string {
  if (label === 'Closed') return 'bg-gray-100 text-gray-700';
  if (label === 'Resolved') return 'bg-emerald-100 text-emerald-800';
  if (label === 'Waiting on User') return 'bg-blue-100 text-blue-800';
  return 'bg-amber-100 text-amber-900';
}

function matchesSearch(t: TicketListItem, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const subject = (t.subject || '').toLowerCase();
  const email = (t.user?.email || '').toLowerCase();
  const name = (t.user?.name || '').toLowerCase();
  return subject.includes(query) || email.includes(query) || name.includes(query);
}

export default function AdminSupportClient() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [selected, setSelected] = useState<TicketListItem | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  async function refreshTickets(): Promise<void> {
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

  async function openTicket(t: TicketListItem): Promise<void> {
    setSelected(t);
    setThread(null);
    setIsOpening(true);
    try {
      const resp = await fetch(`/api/support/tickets/${encodeURIComponent(t.id)}`);
      const data = await resp.json().catch(() => null);
      setThread((data?.thread as Thread) ?? null);
      await refreshTickets(); // reflect cleared admin-unread
    } finally {
      setIsOpening(false);
    }
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
      await openTicket(selected);
    } finally {
      setIsSending(false);
    }
  }

  async function updateStatus(nextStatus: 'pending' | 'resolved' | 'closed') {
    if (!selected?.id || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await fetch(`/api/support/tickets/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await openTicket(selected);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  useEffect(() => {
    refreshTickets();
    const t = setInterval(refreshTickets, 12000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages?.length, isOpening]);

  const filtered = useMemo(() => {
    const bySearch = tickets.filter((t) => matchesSearch(t, search));
    if (statusFilter === 'all') return bySearch;
    if (statusFilter === 'unread') return bySearch.filter((t) => (t.unreadForAdmin ?? 0) > 0);
    return bySearch.filter((t) => t.status === statusFilter);
  }, [tickets, search, statusFilter]);

  const openTickets = useMemo(
    () => filtered.filter((t) => t.status === 'open' || t.status === 'pending' || t.status === 'admin_replied'),
    [filtered]
  );

  const resolvedTickets = useMemo(
    () => filtered.filter((t) => t.status === 'resolved' || t.status === 'closed'),
    [filtered]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Support</h1>
          <p className="mt-2 text-sm text-gray-600">View, manage, and reply to support tickets.</p>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject, name, or email…"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <div className="w-full md:w-72">
            <label className="block text-xs font-medium text-gray-600">Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            >
              <option value="all">All statuses</option>
              <option value="open">Open (waiting on admin)</option>
              <option value="pending">Pending</option>
              <option value="admin_replied">Waiting on user</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="unread">Unread (admin)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Open Tickets */}
      <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Open Tickets</h2>
            <p className="mt-1 text-sm text-gray-600">Open, pending, and waiting on user.</p>
          </div>
          <button
            type="button"
            onClick={refreshTickets}
            className="text-sm font-medium text-indigo-700 hover:underline"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ticket ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Submitted By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Created At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Last Updated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Unread</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-sm text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : openTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-sm text-gray-500">
                    No open tickets.
                  </td>
                </tr>
              ) : (
                openTickets.map((t) => {
                  const label = uiStatusLabel(t.status);
                  const unread = t.unreadForAdmin ?? 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{t.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[320px] truncate">{t.subject}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{t.user?.name || t.userId}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.user?.email || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatTime(t.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatTime(t.updatedAt || t.lastMessageAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClasses(label)}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {unread > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold">
                            {unread}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openTicket(t)}
                          className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          View Ticket
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Resolved Tickets */}
      <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Resolved Tickets</h2>
          <p className="mt-1 text-sm text-gray-600">Resolved and closed tickets.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ticket ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Submitted By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Created At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Resolved At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-sm text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : resolvedTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-sm text-gray-500">
                    No resolved tickets.
                  </td>
                </tr>
              ) : (
                resolvedTickets.map((t) => {
                  const label = uiStatusLabel(t.status);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{t.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[320px] truncate">{t.subject}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{t.user?.name || t.userId}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.user?.email || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatTime(t.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatTime(t.resolvedAt || null) || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClasses(label)}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openTicket(t)}
                          className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          View Ticket
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ticket detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{selected.subject}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClasses(
                      uiStatusLabel(thread?.ticket?.status || selected.status)
                    )}`}
                  >
                    {uiStatusLabel(thread?.ticket?.status || selected.status)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
                  <div>
                    <span className="text-gray-500">Submitted by:</span>{' '}
                    <span className="font-medium text-gray-900">{selected.user?.name || selected.userId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>{' '}
                    <span className="font-medium text-gray-900">{selected.user?.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Role:</span>{' '}
                    <span className="font-medium text-gray-900">{selected.role}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="font-medium text-gray-900">{formatTime(selected.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => updateStatus('pending')}
                  disabled={isUpdatingStatus}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Mark as Pending
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus('resolved')}
                  disabled={isUpdatingStatus}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mark as Resolved
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus('closed')}
                  disabled={isUpdatingStatus}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  Close Ticket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setThread(null);
                    setReply('');
                  }}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5">
              <div className="lg:col-span-5 flex flex-col">
                <div ref={scrollRef} className="h-[60vh] overflow-y-auto bg-gray-50 p-4 space-y-3">
                  {!thread ? (
                    <div className="text-sm text-gray-500">{isOpening ? 'Loading…' : 'Unable to load ticket.'}</div>
                  ) : thread.messages.length === 0 ? (
                    <div className="text-sm text-gray-500">No messages yet.</div>
                  ) : (
                    thread.messages.map((m) => {
                      const isAdmin = m.senderRole === 'admin';
                      return (
                        <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                              isAdmin
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-800 border border-gray-200'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                            <p className={`mt-1 text-[11px] ${isAdmin ? 'text-indigo-100/90' : 'text-gray-400'}`}>
                              {formatTime(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendReply} className="border-t border-gray-200 bg-white p-4">
                  <label className="block text-xs font-medium text-gray-600">Reply</label>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Write a reply…"
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    disabled={isSending || (thread?.ticket?.status === 'closed')}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {thread?.ticket?.status === 'closed' ? 'This ticket is closed.' : ''}
                    </div>
                    <button
                      type="submit"
                      disabled={!reply.trim() || isSending || (thread?.ticket?.status === 'closed')}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

