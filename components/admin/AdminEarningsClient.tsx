'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type UserRow = {
  id: string;
  name?: string;
  email?: string;
  roles?: string[];
};

type SessionRow = {
  id: string;
  providerId: string;
  providerName?: string;
  status?: string;
  payoutStatus?: string;
  provider_payout_cents?: number;
  ivyway_take_cents?: number;
  total_charge_cents?: number;
  [key: string]: unknown;
};

type CreditRow = {
  id: string;
  providerId: string;
  sessionId: string;
  amountCents: number;
  createdAt: string;
};

type BankAccountRow = {
  providerId: string;
  bankName: string;
  last4: string;
  accountType: string;
  connectedAt: string;
  status: string;
};

type Balances = Record<string, { balanceCents: number; updatedAt: string }>;

type PayoutRequestRow = {
  id: string;
  providerId: string;
  providerName?: string;
  providerEmail?: string;
  amountCents: number;
  status: string;
  createdAt: string;
  approvedAt?: string;
  paidAt?: string;
  payoutMethod?: string;
  payoutDestination?: string;
  payoutDetails?: {
    payoutMethod?: string;
    wiseEmail?: string;
    paypalEmail?: string;
    zelleContact?: string;
    bankName?: string;
    bankCountry?: string;
    hasBankAccountNumber?: boolean;
    bankAccountNumberLast4?: string | null;
    hasBankRoutingNumber?: boolean;
    bankRoutingNumberLast4?: string | null;
    bankRoutingNumber?: string;
  };
};

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDateTime(iso: unknown): string {
  const s = typeof iso === 'string' ? iso : '';
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function normalizePayoutMethod(raw: unknown): 'wise' | 'paypal' | 'zelle' | 'bank' | null {
  const m = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!m) return null;
  if (m === 'wise') return 'wise';
  if (m === 'paypal' || m === 'pay pal') return 'paypal';
  if (m === 'zelle') return 'zelle';
  if (m === 'bank' || m === 'bank_transfer' || m === 'bank transfer' || m === 'wire' || m === 'ach') return 'bank';
  return null;
}

function payoutMethodLabel(details?: PayoutRequestRow['payoutDetails']): string {
  if (!details) return '—';
  const normalized = normalizePayoutMethod(details.payoutMethod);
  if (normalized === 'wise') return 'Wise';
  if (normalized === 'paypal') return 'PayPal';
  if (normalized === 'zelle') return 'Zelle';
  if (normalized === 'bank') return 'Bank Transfer';
  const raw = typeof details.payoutMethod === 'string' ? details.payoutMethod.trim() : '';
  return raw || '—';
}

function payoutDestinationLabelFromDetails(details?: PayoutRequestRow['payoutDetails']): string {
  if (!details) return '—';
  const normalized = normalizePayoutMethod(details.payoutMethod);
  if (normalized === 'wise') return details.wiseEmail ? details.wiseEmail : '—';
  if (normalized === 'paypal') return details.paypalEmail ? details.paypalEmail : '—';
  if (normalized === 'zelle') return details.zelleContact ? details.zelleContact : '—';
  if (normalized === 'bank') {
    const bank = details.bankName ? details.bankName : '—';
    const acct =
      details.hasBankAccountNumber && details.bankAccountNumberLast4 ? `acct ••••${details.bankAccountNumberLast4}` : 'acct —';
    const routing =
      details.hasBankRoutingNumber && details.bankRoutingNumberLast4 ? `routing ••••${details.bankRoutingNumberLast4}` : '';
    return [bank, acct, routing].filter(Boolean).join(' • ');
  }
  return '—';
}

function payoutMethodLabelForRow(row: PayoutRequestRow): string {
  const direct = typeof row.payoutMethod === 'string' ? row.payoutMethod.trim() : '';
  if (direct) return direct;
  return payoutMethodLabel(row.payoutDetails);
}

function payoutDestinationLabelForRow(row: PayoutRequestRow): string {
  const direct = typeof row.payoutDestination === 'string' ? row.payoutDestination.trim() : '';
  if (direct) return direct;
  return payoutDestinationLabelFromDetails(row.payoutDetails);
}

function isProviderUser(u: UserRow): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && (roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor'));
}

type ApiResponse = Record<string, unknown>;

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

export default function AdminEarningsClient(props: {
  initialUsers: UserRow[];
  initialSessions: SessionRow[];
  initialCredits: CreditRow[];
  initialBankAccounts: BankAccountRow[];
  initialBalances: Balances;
  initialPayoutRequests: PayoutRequestRow[];
}) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances>(props.initialBalances || {});
  const [providerSearch, setProviderSearch] = useState<string>('');
  const [selectedPayoutRequest, setSelectedPayoutRequest] = useState<PayoutRequestRow | null>(null);

  useEffect(() => {
    if (!selectedPayoutRequest) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPayoutRequest(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedPayoutRequest]);

  const providers = useMemo(() => {
    const users = props.initialUsers || [];
    return users.filter(isProviderUser);
  }, [props.initialUsers]);

  const bankByProvider = useMemo(() => {
    const m = new Map<string, BankAccountRow>();
    for (const b of props.initialBankAccounts || []) {
      if (b?.status === 'active') m.set(b.providerId, b);
    }
    return m;
  }, [props.initialBankAccounts]);

  const completedSessions = useMemo(
    () => (props.initialSessions || []).filter((s) => String(s?.status || '') === 'completed'),
    [props.initialSessions]
  );

  const totals = useMemo(() => {
    let platform = 0;
    let provider = 0;
    let pendingPayouts = 0;
    for (const s of completedSessions) {
      platform += Number(s.ivyway_take_cents || 0);
      provider += Number(s.provider_payout_cents || 0);
      const ps = String(s.payoutStatus || 'available');
      if (ps === 'pending_payout' || ps === 'approved') pendingPayouts += Number(s.provider_payout_cents || 0);
    }
    return { platform, provider, pendingPayouts };
  }, [completedSessions]);

  const providerRows = useMemo(() => {
    const byProviderSessions = new Map<string, SessionRow[]>();
    for (const s of completedSessions) {
      const arr = byProviderSessions.get(s.providerId) || [];
      arr.push(s);
      byProviderSessions.set(s.providerId, arr);
    }

    return providers.map((p) => {
      const ps = byProviderSessions.get(p.id) || [];
      const earnings = ps.reduce((sum, s) => sum + Number(s.provider_payout_cents || 0), 0);
      const withdrawn = ps
        .filter((s) => {
          const st = String(s.payoutStatus || 'available');
          return st === 'paid' || st === 'paid_out';
        })
        .reduce((sum, s) => sum + Number(s.provider_payout_cents || 0), 0);
      const completedCount = ps.length;
      const pending = ps.filter((s) => {
        const st = String(s.payoutStatus || 'available');
        return st === 'pending_payout' || st === 'approved';
      }).length;
      const account = bankByProvider.get(p.id) || null;
      const balanceCents = balances[p.id]?.balanceCents ?? 0;
      return {
        providerId: p.id,
        name: p.name || p.email || p.id,
        email: p.email || '',
        completedCount,
        earningsCents: earnings,
        withdrawnCents: withdrawn,
        availableCents: Math.max(0, earnings - withdrawn),
        pendingCount: pending,
        balanceCents,
        bank: account ? `${account.bankName} ••••${account.last4}` : '—',
      };
    });
  }, [providers, completedSessions, bankByProvider, balances]);

  const filteredProviderRows = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    if (!q) return providerRows;
    return providerRows.filter((r) => {
      const name = String(r.name || '').toLowerCase();
      const email = String(r.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [providerRows, providerSearch]);

  async function setPayoutStatus(sessionId: string, payoutStatus: string) {
    setWorking(sessionId);
    setError(null);
    try {
      await post('/api/admin/payouts/set-status', { sessionId, payoutStatus });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update payout status');
    } finally {
      setWorking(null);
    }
  }

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

  async function adjustBalance(providerId: string) {
    const deltaStr = window.prompt('Adjust balance (cents). Example: 5000 or -5000', '0');
    if (deltaStr == null) return;
    const deltaCents = Number(deltaStr);
    if (!Number.isFinite(deltaCents) || !Number.isInteger(deltaCents)) {
      setError('deltaCents must be an integer');
      return;
    }
    setWorking(providerId);
    setError(null);
    try {
      const data = await post('/api/admin/earnings/adjust-balance', { providerId, deltaCents });
      const nextBalance = data['balance'];
      if (
        nextBalance &&
        typeof nextBalance === 'object' &&
        typeof (nextBalance as { balanceCents?: unknown }).balanceCents === 'number' &&
        typeof (nextBalance as { updatedAt?: unknown }).updatedAt === 'string'
      ) {
        setBalances((prev) => ({ ...prev, [providerId]: nextBalance as Balances[string] }));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to adjust balance');
    } finally {
      setWorking(null);
    }
  }

  const actionableSessions = useMemo(() => {
    return completedSessions
      .filter((s) => {
        const ps = String(s.payoutStatus || 'available');
        return ps === 'pending_payout' || ps === 'approved' || ps === 'available' || ps === 'locked';
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 50);
  }, [completedSessions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Earnings & Payouts</h1>
        <p className="mt-2 text-sm text-gray-600">Revenue, provider earnings, and payout controls.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Platform revenue</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{money(totals.platform)}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Provider earnings (completed)</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{money(totals.provider)}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Pending payouts (sessions)</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{money(totals.pendingPayouts)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Providers</div>
            <div className="text-sm text-gray-500">
              {filteredProviderRows.length}
              {providerSearch.trim() ? ` / ${providerRows.length}` : ''}
            </div>
          </div>
          <div className="w-full sm:max-w-sm">
            <label className="sr-only" htmlFor="provider-search">
              Search providers
            </label>
            <input
              id="provider-search"
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              placeholder="Search providers by name or email…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Completed sessions</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Earnings</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Withdrawal status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Bank</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Admin actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredProviderRows.map((r) => {
                const busy = working === r.providerId;
                const withdrawalStatus =
                  r.pendingCount > 0 ? 'pending' : r.balanceCents > 0 ? 'available' : '—';
                return (
                  <tr key={r.providerId} className={busy ? 'opacity-70' : ''}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{r.name}</div>
                      {r.email ? <div className="mt-0.5 text-xs text-gray-500">{r.email}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.completedCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="space-y-0.5">
                        <div>
                          <span className="text-gray-500">Total Earned:</span>{' '}
                          <span className="font-medium text-gray-900">{money(r.earningsCents)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Withdrawn:</span>{' '}
                          <span className="font-medium text-gray-900">{money(r.withdrawnCents)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Available Balance:</span>{' '}
                          <span className="font-medium text-gray-900">{money(r.availableCents)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{withdrawalStatus}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.bank}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => adjustBalance(r.providerId)}
                          disabled={busy}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Adjust earnings
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProviderRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                    No providers found{providerSearch.trim() ? ' for that search.' : '.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Payout queue (recent)</div>
          <div className="text-sm text-gray-500">{actionableSessions.length}</div>
        </div>
        <div className="divide-y divide-gray-200">
          {actionableSessions.map((s) => {
            const busy = working === s.id;
            const ps = String(s.payoutStatus || 'available');
            return (
              <div key={s.id} className={['px-4 py-3 flex items-center justify-between gap-3', busy ? 'opacity-70' : ''].join(' ')}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.providerName || s.providerId}</div>
                  <div className="mt-1 text-xs text-gray-600 font-mono truncate">{s.id}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    payoutStatus: <span className="font-semibold">{ps}</span> • {money(Number(s.provider_payout_cents || 0))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/users/${encodeURIComponent(String(s.providerId || ''))}`}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    View Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPayoutStatus(s.id, 'approved')}
                    disabled={busy}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutStatus(s.id, 'locked')}
                    disabled={busy}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Hold
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutStatus(s.id, 'paid')}
                    disabled={busy}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Mark paid
                  </button>
                </div>
              </div>
            );
          })}
          {actionableSessions.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-600">No payout actions pending.</div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Payout Requests</div>
          <div className="text-sm text-gray-500">{(props.initialPayoutRequests || []).length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Payout Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Payout Destination</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Requested At</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(props.initialPayoutRequests || []).map((r) => {
                const busy = working === r.id;
                const status = String(r.status || '');
                const canApprove = status === 'pending' || status === 'pending_admin_review';
                const canMarkPaid = status === 'approved' || status === 'processing';
                const providerLabel = r.providerName || r.providerEmail || r.providerId;
                return (
                  <tr key={r.id} className={busy ? 'opacity-70' : ''}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 truncate">{providerLabel}</div>
                      {r.providerEmail ? <div className="mt-0.5 text-xs text-gray-500 truncate">{r.providerEmail}</div> : null}
                      <div className="mt-1 text-xs text-gray-600 font-mono truncate">{r.id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{money(Number(r.amountCents || 0))}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payoutMethodLabelForRow(r)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payoutDestinationLabelForRow(r)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                        {status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPayoutRequest(r)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          Details
                        </button>
                        <Link
                          href={`/admin/users/${encodeURIComponent(String(r.providerId || ''))}`}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          Profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canApprove) return;
                            approvePayoutRequest(r.id);
                          }}
                          disabled={busy || !canApprove}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canMarkPaid) return;
                            const ok = window.confirm('Confirm you have sent this payout manually.');
                            if (!ok) return;
                            markPayoutRequestPaid(r.id);
                          }}
                          disabled={busy || !canMarkPaid}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(props.initialPayoutRequests || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-600">
                    No payout requests pending.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayoutRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setSelectedPayoutRequest(null)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold leading-6 text-gray-900">Payout details</h3>
                  <div className="mt-1 text-xs text-gray-600 font-mono break-all">{selectedPayoutRequest.id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayoutRequest(null)}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600">Request</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-800">
                    <div>
                      <span className="text-gray-500">Amount:</span>{' '}
                      <span className="font-semibold text-gray-900">{money(Number(selectedPayoutRequest.amountCents || 0))}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>{' '}
                      <span className="font-semibold">{String(selectedPayoutRequest.status || '—')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Requested:</span> {formatDateTime(selectedPayoutRequest.createdAt)}
                    </div>
                    <div>
                      <span className="text-gray-500">Approved:</span> {formatDateTime(selectedPayoutRequest.approvedAt)}
                    </div>
                    <div>
                      <span className="text-gray-500">Paid:</span> {formatDateTime(selectedPayoutRequest.paidAt)}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600">Provider</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-800">
                    <div className="font-semibold text-gray-900">
                      {selectedPayoutRequest.providerName || selectedPayoutRequest.providerEmail || selectedPayoutRequest.providerId}
                    </div>
                    {selectedPayoutRequest.providerEmail ? (
                      <div className="text-xs text-gray-500">{selectedPayoutRequest.providerEmail}</div>
                    ) : null}
                    <div className="text-xs text-gray-600 font-mono break-all">{selectedPayoutRequest.providerId}</div>
                    <div className="pt-2">
                      <Link
                        href={`/admin/users/${encodeURIComponent(String(selectedPayoutRequest.providerId || ''))}`}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        View provider profile →
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 p-4 sm:col-span-2">
                  <div className="text-xs font-semibold text-gray-600">Payout destination</div>
                  <div className="mt-2 text-sm text-gray-800">
                    {selectedPayoutRequest.payoutDestination ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-gray-500">Method</div>
                          <div className="font-semibold text-gray-900">{payoutMethodLabelForRow(selectedPayoutRequest)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Summary</div>
                          <div className="text-gray-900">{payoutDestinationLabelForRow(selectedPayoutRequest)}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs text-gray-500">Snapshot</div>
                          <div className="font-mono break-all text-gray-900">{selectedPayoutRequest.payoutDestination}</div>
                        </div>
                      </div>
                    ) : !selectedPayoutRequest.payoutDetails ? (
                      <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
                        No payout details on file for this provider.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-gray-500">Method</div>
                          <div className="font-semibold text-gray-900">
                            {payoutMethodLabel(selectedPayoutRequest.payoutDetails)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Summary</div>
                          <div className="text-gray-900">{payoutDestinationLabelFromDetails(selectedPayoutRequest.payoutDetails)}</div>
                        </div>

                        {normalizePayoutMethod(selectedPayoutRequest.payoutDetails.payoutMethod) === 'wise' && (
                          <div className="sm:col-span-2">
                            <div className="text-xs text-gray-500">Wise email</div>
                            <div className="font-mono break-all">{selectedPayoutRequest.payoutDetails.wiseEmail || '—'}</div>
                          </div>
                        )}
                        {normalizePayoutMethod(selectedPayoutRequest.payoutDetails.payoutMethod) === 'paypal' && (
                          <div className="sm:col-span-2">
                            <div className="text-xs text-gray-500">PayPal email</div>
                            <div className="font-mono break-all">{selectedPayoutRequest.payoutDetails.paypalEmail || '—'}</div>
                          </div>
                        )}
                        {normalizePayoutMethod(selectedPayoutRequest.payoutDetails.payoutMethod) === 'zelle' && (
                          <div className="sm:col-span-2">
                            <div className="text-xs text-gray-500">Zelle contact</div>
                            <div className="font-mono break-all">{selectedPayoutRequest.payoutDetails.zelleContact || '—'}</div>
                          </div>
                        )}
                        {normalizePayoutMethod(selectedPayoutRequest.payoutDetails.payoutMethod) === 'bank' && (
                          <>
                            <div>
                              <div className="text-xs text-gray-500">Bank name</div>
                              <div className="text-gray-900">{selectedPayoutRequest.payoutDetails.bankName || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Bank country</div>
                              <div className="text-gray-900">{selectedPayoutRequest.payoutDetails.bankCountry || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Account number</div>
                              <div className="text-gray-900">
                                {selectedPayoutRequest.payoutDetails.hasBankAccountNumber &&
                                selectedPayoutRequest.payoutDetails.bankAccountNumberLast4
                                  ? `••••${selectedPayoutRequest.payoutDetails.bankAccountNumberLast4}`
                                  : '—'}
                              </div>
                            </div>
                            {selectedPayoutRequest.payoutDetails.bankRoutingNumber ? (
                              <div className="sm:col-span-2">
                                <div className="text-xs text-gray-500">Routing number</div>
                                <div className="font-mono break-all text-gray-900">{selectedPayoutRequest.payoutDetails.bankRoutingNumber}</div>
                              </div>
                            ) : selectedPayoutRequest.payoutDetails.hasBankRoutingNumber &&
                              selectedPayoutRequest.payoutDetails.bankRoutingNumberLast4 ? (
                              <div className="sm:col-span-2">
                                <div className="text-xs text-gray-500">Routing number</div>
                                <div className="font-mono break-all text-gray-900">
                                  ••••{selectedPayoutRequest.payoutDetails.bankRoutingNumberLast4}
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedPayoutRequest(null)}
                  className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const status = String(selectedPayoutRequest.status || '');
                    const canApprove = status === 'pending' || status === 'pending_admin_review';
                    if (!canApprove) return;
                    approvePayoutRequest(selectedPayoutRequest.id);
                  }}
                  disabled={
                    working === selectedPayoutRequest.id ||
                    !(
                      String(selectedPayoutRequest.status || '') === 'pending' ||
                      String(selectedPayoutRequest.status || '') === 'pending_admin_review'
                    )
                  }
                  className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 sm:w-auto"
                >
                  Approve payout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const status = String(selectedPayoutRequest.status || '');
                    const canMarkPaid = status === 'approved' || status === 'processing';
                    if (!canMarkPaid) return;
                    const ok = window.confirm('Confirm you have sent this payout manually.');
                    if (!ok) return;
                    markPayoutRequestPaid(selectedPayoutRequest.id);
                  }}
                  disabled={
                    working === selectedPayoutRequest.id ||
                    !(String(selectedPayoutRequest.status || '') === 'approved' || String(selectedPayoutRequest.status || '') === 'processing')
                  }
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                >
                  Mark paid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


