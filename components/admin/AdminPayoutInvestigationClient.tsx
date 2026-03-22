'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type InvestigationResult = {
  provider: { id: string; name: string; email: string };
  providerProfile: { payoutMethod?: string; bankName?: string; bankAccountNumberLast4?: string | null } | null;
  metrics: {
    totalProviderEarningsCents: number;
    availableBalanceCents: number;
    pendingPayoutsCents: number;
    pendingPayoutsCount: number;
    completedPayoutsCents: number;
    completedPayoutsCount: number;
    lastPayoutDate: string | null;
    lastPayoutAmountCents: number | null;
  };
  alerts: Array<{ code: string; message: string; payoutRequestIds?: string[] }>;
  payoutRequests: Array<{
    id: string;
    providerId: string;
    amountCents: number;
    status: string;
    createdAt: string;
    approvedAt: string | null;
    paidAt: string | null;
    payoutMethod: string | null;
    payoutDestinationMasked: string | null;
  }>;
};

type ApiPayload =
  | { success: true; results: InvestigationResult[] }
  | { error: string };

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDate(iso: unknown): string {
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

function canApprove(statusRaw: unknown): boolean {
  const st = normalizeStatus(statusRaw);
  return st === 'pending' || st === 'pending_admin_review';
}

function canMarkPaid(statusRaw: unknown): boolean {
  const st = normalizeStatus(statusRaw);
  return st === 'approved' || st === 'processing';
}

async function getJson(path: string): Promise<ApiPayload> {
  const res = await fetch(path, { method: 'GET' });
  const data = (await res.json().catch(() => ({}))) as ApiPayload;
  const errorMessage =
    (data as any)?.error && typeof (data as any).error === 'string' ? (data as any).error : `Request failed (${res.status})`;
  if (!res.ok) throw new Error(errorMessage);
  return data;
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  const errorMessage = typeof (data as any)?.error === 'string' ? (data as any).error : `Request failed (${res.status})`;
  if (!res.ok) throw new Error(errorMessage);
  return data;
}

function MetricCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold text-gray-500">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{props.value}</div>
      {props.sub ? <div className="mt-1 text-xs text-gray-600">{props.sub}</div> : null}
    </div>
  );
}

export default function AdminPayoutInvestigationClient() {
  const router = useRouter();
  const [providerEmail, setProviderEmail] = useState('');
  const [providerName, setProviderName] = useState('');
  const [payoutId, setPayoutId] = useState('');
  const [bankLast4Digits, setBankLast4Digits] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InvestigationResult[] | null>(null);

  const [workingPayoutId, setWorkingPayoutId] = useState<string | null>(null);
  const [workingError, setWorkingError] = useState<string | null>(null);

  const query = useMemo(() => {
    const q: Record<string, string> = {};
    if (providerEmail.trim()) q.providerEmail = providerEmail.trim();
    if (providerName.trim()) q.providerName = providerName.trim();
    if (payoutId.trim()) q.payoutId = payoutId.trim();
    if (bankLast4Digits.trim()) q.bankLast4Digits = bankLast4Digits.trim();
    return q;
  }, [providerEmail, providerName, payoutId, bankLast4Digits]);

  async function runSearch() {
    setLoading(true);
    setError(null);
    setResults(null);
    setWorkingError(null);
    try {
      const qs = new URLSearchParams(query);
      const data = await getJson(`/api/admin/payout-investigation?${qs.toString()}`);
      if (!('success' in data) || (data as any).success !== true) {
        throw new Error(typeof (data as any)?.error === 'string' ? (data as any).error : 'Search failed');
      }
      setResults((data as any).results as InvestigationResult[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function approve(payoutRequestId: string) {
    setWorkingPayoutId(payoutRequestId);
    setWorkingError(null);
    try {
      await post('/api/admin/payout-requests/approve', { payoutRequestId });
      await runSearch();
      router.refresh();
    } catch (e) {
      setWorkingError(e instanceof Error ? e.message : 'Failed to approve payout request');
    } finally {
      setWorkingPayoutId(null);
    }
  }

  async function markPaid(payoutRequestId: string) {
    const ok = window.confirm('Confirm you have sent this payout manually.');
    if (!ok) return;
    setWorkingPayoutId(payoutRequestId);
    setWorkingError(null);
    try {
      await post('/api/admin/payout-requests/mark-paid', { payoutRequestId });
      await runSearch();
      router.refresh();
    } catch (e) {
      setWorkingError(e instanceof Error ? e.message : 'Failed to mark payout request paid');
    } finally {
      setWorkingPayoutId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payout Investigation</h1>
        <p className="mt-2 text-sm text-gray-600">Search a provider or payout and diagnose payout complaints fast.</p>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-900">Search</div>
          <div className="mt-1 text-sm text-gray-600">
            Use any combination of fields. For fastest results, paste the payout request ID.
          </div>
        </div>
        <form
          className="px-6 py-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <div className="text-xs font-semibold text-gray-600">Provider email</div>
              <input
                value={providerEmail}
                onChange={(e) => setProviderEmail(e.target.value)}
                placeholder="name@domain.com"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-gray-600">Provider name</div>
              <input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-gray-600">Payout ID</div>
              <input
                value={payoutId}
                onChange={(e) => setPayoutId(e.target.value)}
                placeholder="payoutreq_..."
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-gray-600">Bank last 4 digits</div>
              <input
                value={bankLast4Digits}
                onChange={(e) => setBankLast4Digits(e.target.value)}
                placeholder="1234"
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-600">
              {results ? `Found ${results.length} match${results.length === 1 ? '' : 'es'}.` : '—'}
            </div>
            <button
              type="submit"
              disabled={loading || Object.keys(query).length === 0}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {workingError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{workingError}</div>
      ) : null}

      {results ? (
        results.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">No matches found.</div>
        ) : (
          <div className="space-y-6">
            {results.map((r) => {
              const lastPayoutLabel =
                r.metrics.lastPayoutDate && r.metrics.lastPayoutAmountCents != null
                  ? `${formatDate(r.metrics.lastPayoutDate)} • ${money(r.metrics.lastPayoutAmountCents)}`
                  : '—';

              return (
                <div key={r.provider.id} className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
                  <div className="px-6 py-5 border-b border-gray-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-gray-900 truncate">{r.provider.name}</div>
                        {r.provider.email ? (
                          <div className="mt-1 text-sm text-gray-600 truncate">{r.provider.email}</div>
                        ) : null}
                        <div className="mt-2 text-xs text-gray-500 font-mono break-all">{r.provider.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${encodeURIComponent(r.provider.id)}`}
                          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          View provider profile
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-6">
                    {r.alerts?.length ? (
                      <div className="space-y-2">
                        {r.alerts.map((a) => (
                          <div
                            key={a.code}
                            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                          >
                            {a.message}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        No payout investigation warnings for this provider.
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <MetricCard label="Total provider earnings" value={money(r.metrics.totalProviderEarningsCents)} />
                      <MetricCard label="Available balance" value={money(r.metrics.availableBalanceCents)} />
                      <MetricCard
                        label="Pending payouts"
                        value={money(r.metrics.pendingPayoutsCents)}
                        sub={`${r.metrics.pendingPayoutsCount} request(s)`}
                      />
                      <MetricCard
                        label="Completed payouts"
                        value={money(r.metrics.completedPayoutsCents)}
                        sub={`${r.metrics.completedPayoutsCount} payout(s)`}
                      />
                      <MetricCard label="Last payout" value={lastPayoutLabel} />
                      <MetricCard
                        label="Payout method (profile)"
                        value={r.providerProfile?.payoutMethod ? r.providerProfile.payoutMethod : '—'}
                        sub={
                          r.providerProfile?.bankAccountNumberLast4
                            ? `Bank •••• ${r.providerProfile.bankAccountNumberLast4}`
                            : undefined
                        }
                      />
                    </div>

                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-gray-900">Payout requests</div>
                        <Link href="/admin/payouts" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                          Open payouts queue
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Payout ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Requested</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Destination</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {r.payoutRequests.map((p) => {
                              const busy = workingPayoutId === p.id;
                              return (
                                <tr key={p.id} className={busy ? 'opacity-70' : ''}>
                                  <td className="px-4 py-3">
                                    <div className="text-xs font-mono text-gray-800 break-all">{p.id}</div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{money(p.amountCents)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                                      {p.status || '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.createdAt)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    <div className="text-xs text-gray-700">{p.payoutDestinationMasked || '—'}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                      <Link
                                        href={`/admin/payouts/${encodeURIComponent(p.id)}`}
                                        className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                      >
                                        View payout details
                                      </Link>
                                      <button
                                        type="button"
                                        disabled={busy || !canApprove(p.status)}
                                        onClick={() => approve(p.id)}
                                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Approve payout
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy || !canMarkPaid(p.status)}
                                        onClick={() => markPaid(p.id)}
                                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                      >
                                        Mark payout paid
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {r.payoutRequests.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                                  No payout requests found for this provider.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}

