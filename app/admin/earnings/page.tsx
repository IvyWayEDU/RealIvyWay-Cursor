import type { ReactNode } from 'react';
import { getAdminEarningsAnalytics, type AdminEarningsServiceType } from '@/lib/admin/earnings.server';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function fmtPct(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toFixed(0)}%`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function labelForType(t: AdminEarningsServiceType): string {
  if (t === 'tutoring') return 'Tutoring';
  if (t === 'test_prep') return 'Test Prep';
  if (t === 'virtual_tour') return 'Virtual Tour';
  return 'College Counseling';
}

function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'blue' | 'amber' }) {
  const cls =
    tone === 'green'
      ? 'bg-green-50 text-green-700 ring-green-200'
      : tone === 'blue'
        ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
        : tone === 'amber'
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : 'bg-gray-100 text-gray-800 ring-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

function MiniBars({
  items,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
}) {
  const max = Math.max(1, ...items.map((i) => (Number.isFinite(i.value) ? i.value : 0)));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => {
        const pct = Math.max(0, Math.min(100, (i.value / max) * 100));
        return (
          <div key={i.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">{i.label}</div>
                {i.hint ? <div className="mt-0.5 text-xs text-gray-500">{i.hint}</div> : null}
              </div>
              <div className="text-sm font-semibold text-gray-700 tabular-nums">{fmtPct(i.value)}</div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminEarningsPage() {
  const a = await getAdminEarningsAnalytics();

  const topCards: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Lifetime Gross Revenue', value: money(a.totals.lifetimeGrossRevenueCents), sub: 'Sum of successful student payments' },
    { label: 'Platform Revenue', value: money(a.totals.platformRevenueCents), sub: 'Gross revenue minus provider revenue' },
    { label: 'Provider Revenue', value: money(a.totals.providerRevenueCents), sub: 'Provider earnings from completed sessions' },
    { label: 'Total Paid Out', value: money(a.totals.totalPaidOutCents), sub: 'Payout requests with status = paid' },
    { label: 'Pending Payouts', value: money(a.totals.pendingPayoutsCents), sub: 'Payout requests with status = pending/approved' },
    { label: 'Available Provider Earnings', value: money(a.totals.availableProviderEarningsCents), sub: 'Provider revenue - pending - paid' },
    { label: 'Total Sessions Booked', value: String(a.totals.totalSessionsBooked) },
    { label: 'Completed Sessions', value: String(a.totals.completedSessions) },
    { label: 'Avg Revenue / Session', value: money(a.totals.avgRevenuePerSessionCents), sub: 'Gross / total booked' },
    { label: 'Avg Platform Revenue / Session', value: money(a.totals.avgPlatformRevenuePerSessionCents), sub: 'Platform / total booked' },
  ];

  const bookingPctBars = (Object.entries(a.rankings.bookingsPctByType) as Array<[AdminEarningsServiceType, number]>).map(
    ([type, value]) => ({
      label: labelForType(type),
      value,
      hint: 'of all bookings',
    })
  );

  const rankCard = (title: string, type: AdminEarningsServiceType | null, value?: string) => (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-gray-900">{type ? labelForType(type) : '—'}</div>
        {value ? <Pill tone="blue">{value}</Pill> : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-2 text-sm text-gray-600">Revenue, payout, and booking analytics in one place.</p>
        </div>
        <div className="text-xs text-gray-500">Updated {formatDateTime(a.generatedAt)}</div>
      </div>

      {/* Section 1: Top Summary Cards */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top summary</h2>
          <p className="mt-1 text-sm text-gray-600">High-level totals across payments, earnings, and payouts.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {topCards.map((c) => (
            <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} />
          ))}
        </div>
      </section>

      {/* Section 2: Revenue Breakdown */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Revenue breakdown by session type</h2>
          <p className="mt-1 text-sm text-gray-600">
            Booking and revenue percentages are based on <span className="font-semibold">total sessions booked</span>.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Session type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total bookings</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Gross revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Provider revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Platform revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Avg booking value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">% of bookings</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">% of gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {a.revenueByType.map((r) => (
                  <tr key={r.type}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{labelForType(r.type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{r.bookings}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.grossRevenueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.providerRevenueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.platformRevenueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.avgBookingValueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{fmtPct(r.bookingsPct)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{fmtPct(r.grossRevenuePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 3: Most/least booked + session type percentages */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Session type mix</h2>
          <p className="mt-1 text-sm text-gray-600">Most/least booked and highest/lowest gross revenue session types.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rankCard('Most booked session type', a.rankings.mostBooked)}
          {rankCard('Least booked session type', a.rankings.leastBooked)}
          {rankCard('Highest revenue session type', a.rankings.highestGrossRevenue)}
          {rankCard('Lowest revenue session type', a.rankings.lowestGrossRevenue)}
        </div>

        <MiniBars items={bookingPctBars} />
      </section>

      {/* Section 4: Payout Analytics */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Payout analytics</h2>
          <p className="mt-1 text-sm text-gray-600">Request counts, distribution, and totals by provider.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total payout requests" value={String(a.payoutAnalytics.totalRequests)} />
          <StatCard label="Pending payout requests" value={String(a.payoutAnalytics.pendingRequests)} />
          <StatCard label="Approved payout requests" value={String(a.payoutAnalytics.approvedRequests)} />
          <StatCard label="Paid payout requests" value={String(a.payoutAnalytics.paidRequests)} />
          <StatCard label="Average payout request amount" value={money(a.payoutAnalytics.avgRequestAmountCents)} />
          <StatCard label="Largest payout request" value={money(a.payoutAnalytics.largestRequestCents)} />
          <StatCard label="Smallest payout request" value={money(a.payoutAnalytics.smallestRequestCents)} />
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="text-sm text-gray-500">Pending payouts (definition)</div>
            <div className="mt-2">
              <Pill tone="amber">pending + approved</Pill>
            </div>
            <div className="mt-2 text-xs text-gray-500">Matches IvyWay payout request queue logic.</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Provider payout totals</div>
            <div className="text-sm text-gray-500">{a.payoutAnalytics.providerTotals.length}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Pending</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Approved</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {a.payoutAnalytics.providerTotals.slice(0, 50).map((r) => (
                  <tr key={r.providerId}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{r.providerName}</div>
                      {r.providerEmail ? <div className="mt-0.5 text-xs text-gray-500">{r.providerEmail}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.pendingCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.approvedCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.paidCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.totalRequestedCents)}</td>
                  </tr>
                ))}
                {a.payoutAnalytics.providerTotals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-600">
                      No payout requests found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 5: Provider Earnings Leaderboard */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Provider earnings leaderboard</h2>
          <p className="mt-1 text-sm text-gray-600">Top providers by completed-session earnings.</p>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Completed sessions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total earnings</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Pending payouts</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total paid out</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Available balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {a.providerLeaderboard.slice(0, 50).map((r) => (
                  <tr key={r.providerId}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{r.providerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{r.completedSessions}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.totalEarningsCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.pendingPayoutsCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(r.totalPaidOutCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">
                      <span className="font-semibold text-gray-900">{money(r.availableBalanceCents)}</span>
                    </td>
                  </tr>
                ))}
                {a.providerLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-600">
                      No providers found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 6: Monthly Revenue Trend */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Monthly revenue trend (last 12 months)</h2>
          <p className="mt-1 text-sm text-gray-600">
            Gross revenue is based on booked payments; provider/platform revenue uses completed-session earnings within the same booked month.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Platform</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Paid out</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Pending payouts</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {a.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {m.label} <span className="text-xs text-gray-500">({m.month})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(m.grossRevenueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(m.platformRevenueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(m.providerRevenueCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(m.paidOutCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(m.pendingPayoutsCents)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{m.sessionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 7: Recent Financial Activity */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recent financial activity</h2>
          <p className="mt-1 text-sm text-gray-600">Latest completed-session earnings and payout request events.</p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Session type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {a.recentActivity.map((e) => {
                  const typeLabel =
                    e.type === 'completed_session'
                      ? 'Completed session earnings'
                      : e.type === 'payout_request'
                        ? 'New payout request'
                        : e.type === 'payout_approved'
                          ? 'Approved payout'
                          : 'Paid payout';
                  const pillTone = e.type === 'payout_paid' ? 'green' : e.type === 'payout_approved' ? 'blue' : e.type === 'payout_request' ? 'amber' : 'gray';
                  return (
                    <tr key={`${e.type}:${e.refId}:${e.at}`}>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(e.at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{typeLabel}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">{e.providerName || e.providerId || '—'}</div>
                        {e.providerEmail ? <div className="mt-0.5 text-xs text-gray-500">{e.providerEmail}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{e.sessionType ? labelForType(e.sessionType) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">{money(e.amountCents)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <Pill tone={pillTone as any}>{e.status || '—'}</Pill>
                      </td>
                    </tr>
                  );
                })}
                {a.recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                      No recent activity found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

