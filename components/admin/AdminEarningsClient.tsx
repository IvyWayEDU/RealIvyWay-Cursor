'use client';

import { useMemo, useState } from 'react';
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
  amountCents: number;
  status: string;
  createdAt: string;
  stripeTransferId?: string | null;
};

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
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
      const nextBalance = (data as any)?.balance;
      if (
        nextBalance &&
        typeof nextBalance === 'object' &&
        typeof (nextBalance as any).balanceCents === 'number' &&
        typeof (nextBalance as any).updatedAt === 'string'
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
          <div className="text-sm font-semibold text-gray-900">Payout Requests (pending admin review)</div>
          <div className="text-sm text-gray-500">{(props.initialPayoutRequests || []).length}</div>
        </div>
        <div className="divide-y divide-gray-200">
          {(props.initialPayoutRequests || []).map((r) => {
            const busy = working === r.id;
            return (
              <div
                key={r.id}
                className={['px-4 py-3 flex items-center justify-between gap-3', busy ? 'opacity-70' : ''].join(' ')}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{r.providerId}</div>
                  <div className="mt-1 text-xs text-gray-600 font-mono truncate">{r.id}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    status: <span className="font-semibold">{String(r.status || '')}</span> • {money(Number(r.amountCents || 0))}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">createdAt: {String(r.createdAt || '')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/users/${encodeURIComponent(String(r.providerId || ''))}`}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    View Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => approvePayoutRequest(r.id)}
                    disabled={busy}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve (Stripe Transfer)
                  </button>
                </div>
              </div>
            );
          })}
          {(props.initialPayoutRequests || []).length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-600">No payout requests pending.</div>
          )}
        </div>
      </div>
    </div>
  );
}


