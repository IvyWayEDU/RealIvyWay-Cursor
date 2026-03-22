'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PayoutRequestRow = {
  id: string;
  providerId: string;
  providerName?: string;
  providerEmail?: string;
  amountCents: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  payoutMethod?: string;
  payoutDestination?: string;
};

type ApiResponse = Record<string, unknown>;

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDateTime(iso: unknown): string {
  const s = typeof iso === 'string' ? iso : '';
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeStatus(statusRaw: unknown): string {
  return typeof statusRaw === 'string' ? statusRaw.trim().toLowerCase() : '';
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'processing' | 'paid';
type DateFilter = 'today' | '7d' | '30d' | 'all';

function statusBadge(statusRaw: unknown): { label: string; className: string } {
  const st = normalizeStatus(statusRaw);
  if (st === 'pending' || st === 'pending_admin_review') {
    return {
      label: 'Requested',
      className: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
    };
  }
  if (st === 'approved' || st === 'processing') {
    return {
      label: 'Approved',
      className: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200',
    };
  }
  if (st === 'paid' || st === 'completed') {
    return {
      label: 'Paid',
      className: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    };
  }
  return {
    label: st ? st : '—',
    className: 'bg-gray-50 text-gray-800 ring-1 ring-inset ring-gray-200',
  };
}

function matchesStatusFilter(rowStatusRaw: unknown, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const st = normalizeStatus(rowStatusRaw);
  if (filter === 'pending') return st === 'pending' || st === 'pending_admin_review';
  if (filter === 'approved') return st === 'approved';
  if (filter === 'processing') return st === 'processing';
  if (filter === 'paid') return st === 'paid' || st === 'completed';
  return true;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeQuery(input: string): string[] {
  return String(input || '')
    .trim()
    .toLowerCase()
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function HighlightedText(props: { text: string; tokens: string[] }) {
  const text = props.text || '';
  const tokens = props.tokens || [];
  if (!text) return <span className="text-gray-400">—</span>;
  if (tokens.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <mark key={idx} className="rounded bg-yellow-100 px-0.5 text-yellow-900">
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
}

async function post(path: string, body: unknown): Promise<ApiResponse> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResponse;
  const errorMessage = typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
  if (!res.ok) throw new Error(errorMessage);
  return data;
}

async function getJson(path: string): Promise<ApiResponse> {
  const res = await fetch(path, { method: 'GET' });
  const data = (await res.json().catch(() => ({}))) as ApiResponse;
  const errorMessage = typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
  if (!res.ok) throw new Error(errorMessage);
  return data;
}

type PayoutDetailsPayload = {
  payoutRequest: {
    id: string;
    providerId: string;
    amountCents: number;
    status: string;
    createdAt: string;
    payoutMethod?: string;
  };
  provider: {
    id: string;
    name: string;
    email: string;
  };
  providerPayoutProfile?: {
    payoutMethod?: string;
    wiseEmail?: string;
    paypalEmail?: string;
    zelleContact?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankRoutingNumber?: string;
    bankCountry?: string;
    accountHolderName?: string;
  };
  payoutMethod?: string;
  payoutDetails: {
    payoutMethod?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankRoutingNumber?: string;
    bankCountry?: string;
    accountHolderName?: string;
    wiseEmail?: string;
    paypalEmail?: string;
    zelleContact?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parsePayoutDetailsPayload(data: ApiResponse): PayoutDetailsPayload | null {
  if (!isRecord(data)) return null;
  if (data.success !== true) return null;
  if (!isRecord(data.payoutRequest) || !isRecord(data.provider) || !isRecord(data.payoutDetails)) return null;

  const pr = data.payoutRequest as Record<string, unknown>;
  const provider = data.provider as Record<string, unknown>;
  const details = data.payoutDetails as Record<string, unknown>;
  const providerPayoutProfile = isRecord(data.providerPayoutProfile) ? (data.providerPayoutProfile as Record<string, unknown>) : null;

  const payoutRequestId = typeof pr.id === 'string' ? pr.id : '';
  const providerId = typeof pr.providerId === 'string' ? pr.providerId : '';
  const amountCents = Number(pr.amountCents);
  const status = typeof pr.status === 'string' ? pr.status : '';
  const createdAt = typeof pr.createdAt === 'string' ? pr.createdAt : '';
  if (!payoutRequestId || !providerId || !Number.isFinite(amountCents) || !status || !createdAt) return null;

  return {
    payoutRequest: {
      id: payoutRequestId,
      providerId,
      amountCents: Math.floor(amountCents),
      status,
      createdAt,
      payoutMethod: typeof pr.payoutMethod === 'string' ? pr.payoutMethod : undefined,
    },
    provider: {
      id: typeof provider.id === 'string' ? provider.id : providerId,
      name:
        (typeof provider.name === 'string' && provider.name.trim()) ||
        (typeof provider.email === 'string' && provider.email.trim()) ||
        providerId,
      email: typeof provider.email === 'string' ? provider.email : '',
    },
    providerPayoutProfile: providerPayoutProfile
      ? {
          payoutMethod: typeof providerPayoutProfile.payoutMethod === 'string' ? (providerPayoutProfile.payoutMethod as string) : undefined,
          wiseEmail: typeof providerPayoutProfile.wiseEmail === 'string' ? (providerPayoutProfile.wiseEmail as string) : undefined,
          paypalEmail: typeof providerPayoutProfile.paypalEmail === 'string' ? (providerPayoutProfile.paypalEmail as string) : undefined,
          zelleContact: typeof providerPayoutProfile.zelleContact === 'string' ? (providerPayoutProfile.zelleContact as string) : undefined,
          bankName: typeof providerPayoutProfile.bankName === 'string' ? (providerPayoutProfile.bankName as string) : undefined,
          bankAccountNumber:
            typeof providerPayoutProfile.bankAccountNumber === 'string' ? (providerPayoutProfile.bankAccountNumber as string) : undefined,
          bankRoutingNumber:
            typeof providerPayoutProfile.bankRoutingNumber === 'string' ? (providerPayoutProfile.bankRoutingNumber as string) : undefined,
          bankCountry: typeof providerPayoutProfile.bankCountry === 'string' ? (providerPayoutProfile.bankCountry as string) : undefined,
          accountHolderName:
            typeof providerPayoutProfile.accountHolderName === 'string' ? (providerPayoutProfile.accountHolderName as string) : undefined,
        }
      : undefined,
    payoutMethod: typeof data.payoutMethod === 'string' ? (data.payoutMethod as string) : undefined,
    payoutDetails: {
      payoutMethod: typeof details.payoutMethod === 'string' ? details.payoutMethod : undefined,
      bankName: typeof details.bankName === 'string' ? details.bankName : undefined,
      bankAccountNumber: typeof details.bankAccountNumber === 'string' ? details.bankAccountNumber : undefined,
      bankRoutingNumber: typeof details.bankRoutingNumber === 'string' ? details.bankRoutingNumber : undefined,
      bankCountry: typeof details.bankCountry === 'string' ? details.bankCountry : undefined,
      accountHolderName: typeof details.accountHolderName === 'string' ? details.accountHolderName : undefined,
      wiseEmail: typeof details.wiseEmail === 'string' ? details.wiseEmail : undefined,
      paypalEmail: typeof details.paypalEmail === 'string' ? details.paypalEmail : undefined,
      zelleContact: typeof details.zelleContact === 'string' ? details.zelleContact : undefined,
    },
  };
}

function PayoutRequestsTable(props: {
  rows: PayoutRequestRow[];
  workingId: string | null;
  highlightTokens: string[];
  onViewDetails: (row: PayoutRequestRow) => void;
  actionVariant: 'requested' | 'approved' | 'paid';
  dateColumnLabel: string;
  getDateValue: (row: PayoutRequestRow) => string | undefined;
  emptyText: string;
  onApprove: (payoutRequestId: string) => void;
  onMarkPaid: (payoutRequestId: string) => void;
}) {
  const rows = props.rows || [];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Payout Method</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Destination</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{props.dateColumnLabel}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((r) => {
            const busy = props.workingId === r.id;
            const badge = statusBadge(r.status);
            const providerLabel = r.providerName || r.providerEmail || r.providerId;
            return (
              <tr
                key={r.id}
                className={[
                  busy ? 'opacity-70' : '',
                  !busy ? 'cursor-pointer hover:bg-gray-50' : '',
                ].join(' ')}
                onClick={(e) => {
                  if (busy) return;
                  const target = e.target as HTMLElement | null;
                  if (target?.closest('a,button')) return;
                  props.onViewDetails(r);
                }}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    <HighlightedText text={providerLabel} tokens={props.highlightTokens} />
                  </div>
                  <div className="mt-1">
                    <Link
                      href={`/admin/users/${encodeURIComponent(String(r.providerId || ''))}`}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      View provider profile
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-gray-600 font-mono truncate">
                    <HighlightedText text={String(r.id || '')} tokens={props.highlightTokens} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="truncate">
                    <HighlightedText text={r.providerEmail || '—'} tokens={props.highlightTokens} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <HighlightedText text={money(Number(r.amountCents || 0))} tokens={props.highlightTokens} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <HighlightedText text={r.payoutMethod || '—'} tokens={props.highlightTokens} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <HighlightedText text={r.payoutDestination || '—'} tokens={props.highlightTokens} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(props.getDateValue(r) || '—')}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <span className={['inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold', badge.className].join(' ')}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        props.onViewDetails(r);
                      }}
                      disabled={busy}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      View Payout Details
                    </button>
                    {props.actionVariant === 'requested' ? (
                      <button
                        type="button"
                        onClick={() => {
                          props.onApprove(String(r.id || ''));
                        }}
                        disabled={busy || !(normalizeStatus(r.status) === 'pending' || normalizeStatus(r.status) === 'pending_admin_review')}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve Payout
                      </button>
                    ) : null}
                    {props.actionVariant === 'approved' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm('Confirm you have sent this payout manually.');
                          if (!ok) return;
                          props.onMarkPaid(String(r.id || ''));
                        }}
                        disabled={busy || !(normalizeStatus(r.status) === 'approved' || normalizeStatus(r.status) === 'processing')}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-600">
                {props.emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPayoutsClient(props: { initialPayoutRequests: PayoutRequestRow[] }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<PayoutDetailsPayload | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copiedAt, setCopiedAt] = useState<number | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const rows = props.initialPayoutRequests || [];

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput), 120);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const queryTokens = useMemo(() => tokenizeQuery(deferredQuery), [deferredQuery]);

  const indexedRows = useMemo(() => {
    return rows.map((r) => {
      const status = normalizeStatus(r.status);
      const createdAtMs = Date.parse(String(r.createdAt || '')) || 0;
      const amountCents = Math.max(0, Math.floor(Number(r.amountCents || 0)));
      const amountDollars2 = (amountCents / 100).toFixed(2);
      const amountDollarsTrimmed = amountDollars2.replace(/\.00$/, '');

      const providerLabel = r.providerName || r.providerEmail || r.providerId || '';
      const searchText = [
        providerLabel,
        r.providerEmail || '',
        r.id || '',
        r.payoutMethod || '',
        r.payoutDestination || '',
        status,
        amountDollars2,
        amountDollarsTrimmed,
        String(amountCents),
      ]
        .join(' ')
        .toLowerCase();

      return { row: r, searchText, createdAtMs, status, amountCents };
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const thresholdMs =
      dateFilter === 'today'
        ? startOfToday.getTime()
        : dateFilter === '7d'
          ? now - 7 * 24 * 60 * 60 * 1000
          : dateFilter === '30d'
            ? now - 30 * 24 * 60 * 60 * 1000
            : null;

    return indexedRows
      .filter((x) => matchesStatusFilter(x.status, statusFilter))
      .filter((x) => (thresholdMs == null ? true : x.createdAtMs >= thresholdMs))
      .filter((x) => {
        if (queryTokens.length === 0) return true;
        for (const t of queryTokens) {
          if (!x.searchText.includes(t)) return false;
        }
        return true;
      })
      .map((x) => x.row);
  }, [indexedRows, statusFilter, dateFilter, queryTokens]);

  const requestedRows = useMemo(() => {
    return filteredRows.filter((r) => {
      const st = normalizeStatus(r.status);
      return st === 'pending' || st === 'pending_admin_review';
    });
  }, [filteredRows]);

  const approvedRows = useMemo(() => {
    return filteredRows.filter((r) => {
      const st = normalizeStatus(r.status);
      return st === 'approved' || st === 'processing';
    });
  }, [filteredRows]);

  const paidRows = useMemo(() => {
    return filteredRows.filter((r) => {
      const st = normalizeStatus(r.status);
      return st === 'paid' || st === 'completed';
    });
  }, [filteredRows]);

  async function approvePayoutRequest(payoutRequestId: string) {
    setWorking(payoutRequestId);
    setError(null);
    try {
      await post('/api/admin/payout-requests/approve', { payoutRequestId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve payout request');
    } finally {
      setWorking(null);
    }
  }

  async function markPayoutRequestPaid(payoutRequestId: string) {
    setWorking(payoutRequestId);
    setError(null);
    try {
      await post('/api/admin/payout-requests/mark-paid', { payoutRequestId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark payout request as paid');
    } finally {
      setWorking(null);
    }
  }

  async function openDetailsModal(row: PayoutRequestRow) {
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalData(null);
    try {
      const qs = new URLSearchParams({ payoutRequestId: String(row.id || '') });
      const data = await getJson(`/api/admin/payout-requests/details?${qs.toString()}`);

      const parsed = parsePayoutDetailsPayload(data);
      if (!parsed) throw new Error('Failed to load payout details');
      setModalData(parsed);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Failed to load payout details');
    } finally {
      setModalLoading(false);
    }
  }

  function closeDetailsModal() {
    if (modalLoading) return;
    setModalOpen(false);
    setModalError(null);
    setModalData(null);
  }

  async function modalApprove() {
    if (!modalData) return;
    await approvePayoutRequest(modalData.payoutRequest.id);
    closeDetailsModal();
  }

  async function modalMarkPaid() {
    if (!modalData) return;
    const ok = window.confirm('Confirm you have sent this payout manually.');
    if (!ok) return;
    await markPayoutRequestPaid(modalData.payoutRequest.id);
    closeDetailsModal();
  }

  async function copyPayoutLink() {
    if (!modalData?.payoutRequest?.id) return;
    setCopyError(null);
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin || '').replace(/\/$/, '');
    const url = `${baseUrl}/admin/payouts/${encodeURIComponent(String(modalData.payoutRequest.id))}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('Copy failed');
      }
      setCopiedAt(Date.now());
      window.setTimeout(() => setCopiedAt((v) => (v && Date.now() - v >= 1800 ? null : v)), 2000);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Failed to copy payout link');
    }
  }

  const showingLabel = `${filteredRows.length} payout${filteredRows.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payouts</h1>
        <p className="mt-2 text-sm text-gray-600">Review payout requests, approve, and mark payouts as paid.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-4 border-b border-gray-200 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-900">Search & Filters</div>
            <div className="text-sm text-gray-600">{`Showing ${showingLabel}`}</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search payouts by provider name, email, payout ID, or bank account..."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All</option>
                  <option value="pending">Requested</option>
                  <option value="approved">Approved</option>
                  <option value="processing">Approved (Processing)</option>
                  <option value="paid">Paid</option>
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Date</span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-semibold text-gray-900">{`Requested Payouts (${requestedRows.length})`}</div>
              <div className="text-sm text-gray-600">New payout requests waiting for admin review.</div>
            </div>
          </div>
          <PayoutRequestsTable
            rows={requestedRows}
            workingId={working}
            highlightTokens={queryTokens}
            onViewDetails={openDetailsModal}
            actionVariant="requested"
            dateColumnLabel="Requested At"
            getDateValue={(r) => r.createdAt}
            emptyText="No requested payouts"
            onApprove={approvePayoutRequest}
            onMarkPaid={markPayoutRequestPaid}
          />
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-semibold text-gray-900">{`Approved Payouts (${approvedRows.length})`}</div>
              <div className="text-sm text-gray-600">Reviewed and approved payouts not yet marked as paid.</div>
            </div>
          </div>
          <PayoutRequestsTable
            rows={approvedRows}
            workingId={working}
            highlightTokens={queryTokens}
            onViewDetails={openDetailsModal}
            actionVariant="approved"
            dateColumnLabel="Approved At"
            getDateValue={(r) => r.approvedAt}
            emptyText="No approved payouts"
            onApprove={approvePayoutRequest}
            onMarkPaid={markPayoutRequestPaid}
          />
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-semibold text-gray-900">{`Paid Payouts (${paidRows.length})`}</div>
              <div className="text-sm text-gray-600">Payout history for completed payouts.</div>
            </div>
          </div>
          <PayoutRequestsTable
            rows={paidRows}
            workingId={working}
            highlightTokens={queryTokens}
            onViewDetails={openDetailsModal}
            actionVariant="paid"
            dateColumnLabel="Paid At"
            getDateValue={(r) => r.paidAt}
            emptyText="No paid payouts yet"
            onApprove={approvePayoutRequest}
            onMarkPaid={markPayoutRequestPaid}
          />
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeDetailsModal} />
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
              <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Payout Details</div>
                    <div className="mt-1 text-sm text-gray-600">Full payout destination details are shown only in this modal.</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    className="rounded-md bg-white text-gray-500 hover:text-gray-700"
                    aria-label="Close"
                  >
                    <span className="text-2xl leading-none">×</span>
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                {modalError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{modalError}</div>
                ) : null}
                {copyError ? (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{copyError}</div>
                ) : null}

                {modalLoading ? (
                  <div className="py-10 text-center text-sm text-gray-600">Loading payout details…</div>
                ) : modalData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Provider Name</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">{modalData.provider.name}</div>
                        {modalData.provider.email ? (
                          <div className="mt-0.5 text-xs text-gray-500 truncate">{modalData.provider.email}</div>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Withdrawal Amount</div>
                        <div className="mt-1 text-sm font-medium text-gray-900">{money(modalData.payoutRequest.amountCents)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Requested At</div>
                        <div className="mt-1 text-sm text-gray-900">{formatDateTime(modalData.payoutRequest.createdAt)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Current Status</div>
                        <div className="mt-1 text-sm text-gray-900">{modalData.payoutRequest.status}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Payout Method</div>
                        <div className="mt-1 text-sm text-gray-900">{modalData.payoutDetails.payoutMethod || modalData.payoutMethod || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Payout Request ID</div>
                        <div className="mt-1 text-xs font-mono text-gray-700 break-all">{modalData.payoutRequest.id}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">Destination Details</div>
                      <div className="mt-3 space-y-3">
                        {(() => {
                          const method = (modalData.payoutDetails.payoutMethod || '').toLowerCase();
                          const isBank = method.includes('bank');
                          const isWise = method.includes('wise');
                          const isPaypal = method.includes('paypal');
                          const isZelle = method.includes('zelle');

                          if (isBank) {
                            return (
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                  <div className="text-xs font-semibold text-gray-500">Bank Name</div>
                                  <div className="mt-1 text-sm text-gray-900">{modalData.payoutDetails.bankName || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-500">Bank Country</div>
                                  <div className="mt-1 text-sm text-gray-900">{modalData.payoutDetails.bankCountry || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-500">Full Account Number</div>
                                  <div className="mt-1 text-sm font-mono text-gray-900 break-all">
                                    {modalData.payoutDetails.bankAccountNumber || '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-500">Full Routing Number</div>
                                  <div className="mt-1 text-sm font-mono text-gray-900 break-all">
                                    {modalData.payoutDetails.bankRoutingNumber || '—'}
                                  </div>
                                </div>
                                {modalData.payoutDetails.accountHolderName ? (
                                  <div className="sm:col-span-2">
                                    <div className="text-xs font-semibold text-gray-500">Account Holder Name</div>
                                    <div className="mt-1 text-sm text-gray-900">{modalData.payoutDetails.accountHolderName}</div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          }

                          if (isWise) {
                            return (
                              <div>
                                <div className="text-xs font-semibold text-gray-500">Wise Email</div>
                                <div className="mt-1 text-sm font-mono text-gray-900 break-all">{modalData.payoutDetails.wiseEmail || '—'}</div>
                              </div>
                            );
                          }

                          if (isPaypal) {
                            return (
                              <div>
                                <div className="text-xs font-semibold text-gray-500">PayPal Email</div>
                                <div className="mt-1 text-sm font-mono text-gray-900 break-all">{modalData.payoutDetails.paypalEmail || '—'}</div>
                              </div>
                            );
                          }

                          if (isZelle) {
                            return (
                              <div>
                                <div className="text-xs font-semibold text-gray-500">Zelle Contact</div>
                                <div className="mt-1 text-sm font-mono text-gray-900 break-all">{modalData.payoutDetails.zelleContact || '—'}</div>
                              </div>
                            );
                          }

                          return <div className="text-sm text-gray-700">—</div>;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    disabled={modalLoading}
                    className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={copyPayoutLink}
                    disabled={modalLoading || !modalData}
                    className={[
                      'rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-inset disabled:opacity-50',
                      copiedAt ? 'bg-green-50 text-green-800 ring-green-200 hover:bg-green-100' : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {copiedAt ? 'Copied' : 'Copy Payout Link'}
                  </button>
                  <button
                    type="button"
                    onClick={modalApprove}
                    disabled={
                      modalLoading ||
                      !modalData ||
                      !(modalData.payoutRequest.status === 'pending' || modalData.payoutRequest.status === 'pending_admin_review')
                    }
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve Payout
                  </button>
                  <button
                    type="button"
                    onClick={modalMarkPaid}
                    disabled={modalLoading || !modalData || !(modalData.payoutRequest.status === 'approved' || modalData.payoutRequest.status === 'processing')}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

