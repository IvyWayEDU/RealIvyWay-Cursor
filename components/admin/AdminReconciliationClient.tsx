'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminReconciliation } from '@/lib/admin/reconciliation.server';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDayKey(dayKey: string): string {
  const t = new Date(`${dayKey}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(t)) return dayKey;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="text-sm text-gray-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">{props.value}</div>
      {props.sub ? <div className="mt-1 text-xs text-gray-500">{props.sub}</div> : null}
    </div>
  );
}

function Section(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{props.title}</h2>
        {props.subtitle ? <p className="mt-1 text-sm text-gray-600">{props.subtitle}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function TimeSeriesChart(props: {
  title: string;
  dateKeys: string[];
  values: number[];
  formatValue: (v: number) => string;
  stroke?: string;
}) {
  const stroke = props.stroke || '#4F46E5';
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const pts = useMemo(() => {
    const n = Math.max(0, Math.min(props.dateKeys.length, props.values.length));
    const width = 100;
    const height = 40;
    const pad = { x: 6, y: 6 };
    const chartW = width - pad.x * 2;
    const chartH = height - pad.y * 2;
    const max = Math.max(1, ...props.values.slice(0, n).map((v) => (Number.isFinite(v) ? v : 0)));
    const min = 0;
    const scaleX = (i: number) => pad.x + (i / Math.max(1, n - 1)) * chartW;
    const scaleY = (v: number) => pad.y + chartH - ((v - min) / Math.max(1, max - min)) * chartH;
    return {
      n,
      width,
      height,
      pad,
      max,
      points: props.values.slice(0, n).map((v, i) => ({ x: scaleX(i), y: scaleY(v), v, i })),
    };
  }, [props.dateKeys.length, props.values]);

  const pathD = useMemo(() => {
    if (pts.n === 0) return '';
    if (pts.n === 1) return `M ${pts.points[0]!.x} ${pts.points[0]!.y}`;
    return pts.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [pts]);

  function indexFromEvent(e: React.MouseEvent<SVGSVGElement>): number | null {
    const svg = svgRef.current;
    if (!svg || pts.n <= 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const x = ((e.clientX - rect.left) / rect.width) * pts.width;
    const frac = (x - pts.pad.x) / Math.max(1, pts.width - pts.pad.x * 2);
    const i = Math.round(frac * Math.max(1, pts.n - 1));
    return Math.max(0, Math.min(pts.n - 1, i));
  }

  const hoveredLabel = hovered != null ? props.dateKeys[hovered] : null;
  const hoveredValue = hovered != null ? props.values[hovered] : null;

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm font-semibold text-gray-900">{props.title}</div>
          {hoveredLabel && hoveredValue != null ? (
            <div className="text-xs text-gray-600 tabular-nums">
              {formatDayKey(hoveredLabel)} · <span className="font-semibold text-gray-900">{props.formatValue(hoveredValue)}</span>
            </div>
          ) : (
            <div className="text-xs text-gray-500">Hover for details</div>
          )}
        </div>

        <div className="mt-3 h-44">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${pts.width} ${pts.height}`}
            preserveAspectRatio="none"
            className="w-full h-full"
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => setHovered(indexFromEvent(e))}
          >
            {[0, 0.5, 1].map((r) => {
              const y = pts.pad.y + (1 - r) * (pts.height - pts.pad.y * 2);
              return <line key={r} x1={pts.pad.x} x2={pts.width - pts.pad.x} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />;
            })}
            {pathD ? <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /> : null}
            {hovered != null && pts.points[hovered] ? (
              <circle cx={pts.points[hovered]!.x} cy={pts.points[hovered]!.y} r="2.6" fill={stroke} />
            ) : null}
          </svg>
        </div>

        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{props.dateKeys[0] ? formatDayKey(props.dateKeys[0]) : '—'}</span>
          <span>{props.dateKeys[props.dateKeys.length - 1] ? formatDayKey(props.dateKeys[props.dateKeys.length - 1]!) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

async function downloadReconciliationCsv(days: number) {
  const res = await fetch(`/api/admin/reconciliation?export=csv&days=${days}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ivyway-financial-reconciliation.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminReconciliationClient(props: { initial: AdminReconciliation }) {
  const [data, setData] = useState<AdminReconciliation>(props.initial);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const lastFetchRef = useRef<number>(0);

  const days = data.daily.days || 30;

  async function refresh() {
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;

    try {
      const res = await fetch(`/api/admin/reconciliation?days=${days}`, { method: 'GET' });
      const json = (await res.json().catch(() => null)) as AdminReconciliation | null;
      if (!res.ok || !json) throw new Error('Failed to load reconciliation');
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation');
    }
  }

  useEffect(() => {
    const t = window.setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const lastUpdatedLabel = useMemo(() => {
    const t = new Date(data.generatedAt).getTime();
    if (!Number.isFinite(t)) return '—';
    return new Date(t).toLocaleString();
  }, [data.generatedAt]);

  const discrepancy = data.balanceCheck.studentPaymentsMinusProviderMinusPlatformCents;
  const hasMismatch = !data.balanceCheck.ok;

  const totals = data.totals;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Reconciliation</h1>
          <p className="mt-2 text-sm text-gray-600">Side-by-side totals, balance checks, and daily activity to detect accounting issues early.</p>
          <div className="mt-2 text-xs text-gray-500">Last updated: {lastUpdatedLabel}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              setError(null);
              try {
                await downloadReconciliationCsv(days);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Export failed');
              } finally {
                setExporting(false);
              }
            }}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export Reconciliation CSV'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {hasMismatch ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">Financial discrepancy detected</div>
          <div className="mt-1 tabular-nums">
            Discrepancy: <span className="font-semibold">{money(discrepancy)}</span> ({discrepancy} cents)
          </div>
        </div>
      ) : null}

      <Section title="Reconciliation Totals" subtitle="Student payments, platform revenue, and provider earnings are derived from completed sessions. Payout totals are derived from payout requests.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total student payments received" value={money(totals.totalStudentPaymentsReceivedCents)} />
          <StatCard label="Total platform revenue" value={money(totals.totalPlatformRevenueCents)} />
          <StatCard label="Total provider earnings" value={money(totals.totalProviderEarningsCents)} />
          <StatCard label="Total payouts sent" value={money(totals.totalPayoutsSentCents)} />
          <StatCard label="Total pending payouts" value={money(totals.totalPendingPayoutsCents)} />
        </div>
      </Section>

      <Section title="Balance Check" subtitle="Student payments minus provider earnings minus platform revenue should equal 0.">
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-600">student payments − provider earnings − platform revenue</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2 tabular-nums">
            <span className="text-gray-900 font-semibold">{money(totals.totalStudentPaymentsReceivedCents)}</span>
            <span className="text-gray-400">−</span>
            <span className="text-gray-900 font-semibold">{money(totals.totalProviderEarningsCents)}</span>
            <span className="text-gray-400">−</span>
            <span className="text-gray-900 font-semibold">{money(totals.totalPlatformRevenueCents)}</span>
            <span className="text-gray-400">=</span>
            <span className={hasMismatch ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
              {money(discrepancy)}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 tabular-nums">{discrepancy} cents</div>
        </div>
      </Section>

      <Section title="Daily Activity" subtitle={`Last ${days} days (UTC).`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TimeSeriesChart
            title="Daily revenue"
            dateKeys={data.daily.dateKeys}
            values={data.daily.dailyRevenueCents}
            formatValue={(v) => money(v)}
            stroke="#4F46E5"
          />
          <TimeSeriesChart
            title="Daily payouts"
            dateKeys={data.daily.dateKeys}
            values={data.daily.dailyPayoutsCents}
            formatValue={(v) => money(v)}
            stroke="#0088cb"
          />
          <TimeSeriesChart
            title="Daily bookings"
            dateKeys={data.daily.dateKeys}
            values={data.daily.dailyBookings}
            formatValue={(v) => String(v)}
            stroke="#22c55e"
          />
        </div>
      </Section>
    </div>
  );
}

