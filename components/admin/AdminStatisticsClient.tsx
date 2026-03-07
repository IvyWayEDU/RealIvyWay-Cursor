'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminStatistics } from '@/lib/admin/statistics.server';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function percent(p: number): string {
  return `${(Math.max(0, Math.min(1, p || 0)) * 100).toFixed(1)}%`;
}

function labelService(st: string): string {
  switch (st) {
    case 'tutoring':
      return 'Tutoring';
    case 'test_prep':
      return 'Test Prep';
    case 'college_counseling':
      return 'College Counseling';
    case 'virtual_tour':
      return 'Virtual Tours';
    default:
      return st;
  }
}

function formatMonth(m: string): string {
  // m = YYYY-MM
  const iso = `${m}-01T00:00:00.000Z`;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return m;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function StatCard(props: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="text-sm text-gray-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{String(props.value)}</div>
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

function BarChart(props: {
  items: Array<{ label: string; value: number }>;
  color?: string;
}) {
  const color = props.color || '#4F46E5'; // indigo-600
  const width = 100;
  const height = 60;
  const padding = { top: 10, right: 10, bottom: 18, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...props.items.map((i) => i.value));
  const barW = props.items.length > 0 ? chartW / props.items.length : chartW;

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
      <div className="p-6">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52" preserveAspectRatio="none">
          {/* grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((r) => {
            const y = padding.top + chartH - r * chartH;
            return (
              <line
                key={r}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
            );
          })}

          {props.items.map((item, idx) => {
            const h = (item.value / max) * chartH;
            const x = padding.left + idx * barW + barW * 0.18;
            const w = barW * 0.64;
            const y = padding.top + (chartH - h);
            return (
              <g key={item.label}>
                <rect x={x} y={y} width={w} height={h} fill={color} rx="1.5" />
              </g>
            );
          })}
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
          {props.items.map((i) => (
            <div key={i.label} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <span className="font-medium text-gray-900">{i.label}</span>
              <span className="tabular-nums">{i.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LineChart(props: {
  labels: string[];
  // Match Chart.js naming so tooltip "label" rendering is correct.
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor?: string;
    pointBackgroundColor?: string;
    pointBorderColor?: string;
    pointRadius?: number;
    pointHoverRadius?: number;
    borderWidth?: number;
    tension?: number;
    fill?: boolean;
  }>;
}) {
  // Chart.js-like hover state: nearest x index, plus an anchor point for tooltip positioning.
  const [hovered, setHovered] = useState<{
    i: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      // Round to avoid excessive rerenders from fractional pixels.
      const w = Math.max(0, Math.round(r.width));
      const h = Math.max(0, Math.round(r.height));
      setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Use the real container size so the chart fills full width (no SVG "letterboxing").
  const width = dims.w || 100;
  const height = dims.h || 60;

  // Chart.js-like layout padding (requested).
  const padding = { top: 10, right: 10, bottom: 10, left: 5 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...props.datasets.flatMap((s) => s.data));
  const defaultTension = 0.35; // smooth, but still professional
  const defaultLineWidth = 2;
  const defaultPointRadius = 4;
  const defaultPointHoverRadius = 6;
  const defaultPointBorderWidth = 2;

  const pointsFor = (data: number[]) => {
    return data.map((v, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * chartW;
      const y = padding.top + chartH - (v / max) * chartH;
      return { x, y, v, i };
    });
  };

  function smoothPath(pts: Array<{ x: number; y: number }>, t: number): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;
    if (pts.length === 2) return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[1]!.x} ${pts[1]!.y}`;

    // Catmull-Rom-ish cubic Bezier smoothing with a small tension factor.
    const c = Math.max(0, Math.min(1, t)) * 0.5;
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]!;
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p3 = pts[Math.min(pts.length - 1, i + 2)]!;

      const cp1x = p1.x + (p2.x - p0.x) * c;
      const cp1y = p1.y + (p2.y - p0.y) * c;
      const cp2x = p2.x - (p3.x - p1.x) * c;
      const cp2y = p2.y - (p3.y - p1.y) * c;

      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }

    return d;
  }

  const n = props.labels.length;

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function indexFromSvgX(svgX: number): number {
    const frac = chartW > 0 ? (svgX - padding.left) / chartW : 0;
    const i = Math.round(frac * Math.max(1, n - 1));
    return clamp(i, 0, Math.max(0, n - 1));
  }

  function svgCoordsFromMouseEvent(e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    // Because preserveAspectRatio="none" and viewBox matches rendered size,
    // client -> SVG coords is a simple linear mapping.
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    return { x, y };
  }

  function setHoveredFromEvent(e: React.MouseEvent<SVGSVGElement>) {
    if (n <= 0) return;
    const coords = svgCoordsFromMouseEvent(e);
    if (!coords) return;

    const i = indexFromSvgX(coords.x);

    // Pick the nearest dataset point at this index as the tooltip anchor.
    let best: { x: number; y: number; d2: number } | null = null;
    for (const ds of props.datasets) {
      const v = ds.data[i];
      if (typeof v !== 'number') continue;
      const x = padding.left + (i / Math.max(1, ds.data.length - 1)) * chartW;
      const y = padding.top + chartH - (v / max) * chartH;
      const dx = coords.x - x;
      const dy = coords.y - y;
      const d2 = dx * dx + dy * dy;
      if (!best || d2 < best.d2) best = { x, y, d2 };
    }

    if (!best) return;
    setHovered({ i, anchorX: best.x, anchorY: best.y });
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          {/* plugins.legend.position = 'top' */}
          {props.datasets.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.borderColor }} />
              <span className="font-medium text-gray-900">{s.label}</span>
            </div>
          ))}
        </div>

        <div ref={containerRef} className="w-full h-[320px] relative mt-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="absolute inset-0 w-full h-full"
            // With a viewBox that matches the container's real pixel size, we can safely stretch to fill.
            preserveAspectRatio="none"
            onMouseLeave={() => setHovered(null)}
            // interaction: { mode: 'nearest', axis: 'x', intersect: false }
            // hover: { mode: 'nearest', intersect: false }
            onMouseMove={setHoveredFromEvent}
          >
          {[0, 0.25, 0.5, 0.75, 1].map((r) => {
            const y = padding.top + chartH - r * chartH;
            return (
              <line
                key={r}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* plugins.tooltip: enabled, mode: 'index', intersect: false (implemented via shared hovered index) */}
          {hovered ? (
            <line
              x1={hovered.anchorX}
              x2={hovered.anchorX}
              y1={padding.top}
              y2={padding.top + chartH}
              stroke="rgba(0,0,0,0.10)"
              strokeWidth="1"
            />
          ) : null}

          {props.datasets.map((s) => {
            const pts = pointsFor(s.data);
            const d = smoothPath(pts, s.tension ?? defaultTension);
            const lineWidth = s.borderWidth ?? defaultLineWidth;
            const pointRadius = s.pointRadius ?? defaultPointRadius;
            const pointHoverRadius = s.pointHoverRadius ?? defaultPointHoverRadius;
            const pointBorderWidth = defaultPointBorderWidth;
            const pointFill = s.pointBackgroundColor ?? s.borderColor;
            const pointStroke = s.pointBorderColor ?? s.borderColor;
            return (
              <g key={s.label}>
                {/* fill: false by default to match Chart.js defaults for line charts */}
                {s.fill ? (
                  <path
                    d={`${d} L ${padding.left + chartW} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`}
                    fill={s.backgroundColor ?? 'rgba(0,0,0,0.06)'}
                    stroke="none"
                  />
                ) : null}
                <path
                  d={d}
                  fill="none"
                  stroke={s.borderColor}
                  strokeWidth={String(lineWidth)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {pts.map((p) => (
                  <g key={p.i}>
                    {/* invisible hit target so hover feels stable without changing visuals */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="8"
                      fill="transparent"
                      style={{ cursor: 'default' }}
                      onMouseEnter={() => setHovered({ i: p.i, anchorX: p.x, anchorY: p.y })}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={String(hovered?.i === p.i ? pointHoverRadius : pointRadius)}
                      fill={pointFill}
                      stroke={pointStroke}
                      strokeWidth={String(pointBorderWidth)}
                      // ensure perfectly circular markers
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
              </g>
            );
          })}
          </svg>

          {hovered ? (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: hovered.anchorX,
                top: hovered.anchorY,
                transform: 'translate(12px, -12px)',
              }}
            >
              <div
                // Match requested tooltip styling.
                style={{
                  backgroundColor: '#111',
                  color: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                  minWidth: 180,
                }}
              >
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, lineHeight: '16px' }}>
                  {props.labels[hovered.i] ?? ''}
                </div>
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  {props.datasets.map((ds) => (
                    <div key={ds.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          backgroundColor: ds.borderColor,
                          flex: '0 0 auto',
                        }}
                      />
                      <span style={{ color: '#fff', fontSize: 12, lineHeight: '16px' }}>
                        {ds.label}: {ds.data[hovered.i] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{props.labels[0] || ''}</span>
          <span>{props.labels[props.labels.length - 1] || ''}</span>
        </div>
      </div>
    </div>
  );
}

async function downloadCsv(kind: 'revenue' | 'sessions') {
  const res = await fetch(`/api/admin/statistics?export=${kind}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = kind === 'revenue' ? 'ivyway-revenue.csv' : 'ivyway-sessions.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminStatisticsClient(props: { initial: AdminStatistics }) {
  const [data, setData] = useState<AdminStatistics>(props.initial);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  async function refresh() {
    // Prevent overlapping refresh bursts.
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;

    try {
      const res = await fetch('/api/admin/statistics', { method: 'GET' });
      const json = (await res.json().catch(() => null)) as AdminStatistics | null;
      if (!res.ok || !json) throw new Error('Failed to load statistics');
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load statistics');
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
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    const t = new Date(data.generatedAt).getTime();
    if (!Number.isFinite(t)) return '—';
    return new Date(t).toLocaleString();
  }, [data.generatedAt]);

  const serviceRevenueCards = data.revenueOverview.byService.map((s) => ({
    label: labelService(s.serviceType),
    revenue: money(s.revenueCents),
    pct: percent(s.percentOfTotal),
  }));

  const popularityItems = data.servicePopularity.sessionsByService.map((s) => ({
    label: labelService(s.serviceType),
    value: s.sessionCount,
  }));

  const signupLabels = data.userGrowth.signupsPerMonth.map((p) => formatMonth(p.month));
  const studentSeries = data.userGrowth.signupsPerMonth.map((p) => p.studentSignups);
  const providerSeries = data.userGrowth.signupsPerMonth.map((p) => p.providerSignups);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
          <p className="mt-2 text-sm text-gray-600">Owner-level performance analytics for the entire platform.</p>
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
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('revenue');
              setError(null);
              try {
                await downloadCsv('revenue');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Export failed');
              } finally {
                setExporting(null);
              }
            }}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {exporting === 'revenue' ? 'Exporting…' : 'Export Revenue CSV'}
          </button>
          <button
            type="button"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('sessions');
              setError(null);
              try {
                await downloadCsv('sessions');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Export failed');
              } finally {
                setExporting(null);
              }
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
          >
            {exporting === 'sessions' ? 'Exporting…' : 'Export Sessions CSV'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <Section title="Revenue Overview" subtitle="Platform revenue is computed from completed sessions only.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Revenue (all time)" value={money(data.revenueOverview.totalRevenueCents)} />
          <StatCard label="Revenue This Month" value={money(data.revenueOverview.revenueThisMonthCents)} />
          <StatCard label="Revenue Last Month" value={money(data.revenueOverview.revenueLastMonthCents)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {serviceRevenueCards.map((c) => (
            <StatCard key={c.label} label={`${c.label} Revenue`} value={c.revenue} sub={`${c.pct} of total`} />
          ))}
        </div>
      </Section>

      <Section title="Service Popularity" subtitle="Sessions booked by service type (all statuses).">
        <BarChart items={popularityItems} color="#4F46E5" />
      </Section>

      <Section title="User Growth" subtitle="Signups per month.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Students" value={data.userGrowth.totals.totalStudents} />
          <StatCard label="Total Providers" value={data.userGrowth.totals.totalProviders} />
          <StatCard label="Total Counselors" value={data.userGrowth.totals.totalCounselors} />
          <StatCard label="Total Tutors" value={data.userGrowth.totals.totalTutors} />
        </div>

        <LineChart
          labels={signupLabels}
          datasets={[
            // Dataset labels are used by tooltip rendering.
            {
              label: 'Student Signups',
              data: studentSeries,
              borderColor: '#0088cb', // IvyWay blue
              backgroundColor: 'rgba(0,136,203,0.15)',
              pointBackgroundColor: '#0088cb',
              pointBorderColor: '#0088cb',
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
              tension: 0.35,
              fill: false,
            },
            {
              label: 'Provider Signups',
              data: providerSeries,
              borderColor: '#22c55e', // green
              backgroundColor: 'rgba(34,197,94,0.15)',
              pointBackgroundColor: '#22c55e',
              pointBorderColor: '#22c55e',
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
              tension: 0.35,
              fill: false,
            },
          ]}
        />
      </Section>

      <Section title="Session Health Metrics" subtitle="Operational signals and risk flags.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Sessions Booked" value={data.sessionHealth.totalSessionsBooked} />
          <StatCard label="Sessions Completed" value={data.sessionHealth.sessionsCompleted} />
          <StatCard label="No-Show (provider)" value={data.sessionHealth.sessionsNoShowProvider} />
          <StatCard label="No-Show (student)" value={data.sessionHealth.sessionsNoShowStudent} />
          <StatCard label="Refunded Sessions" value={data.sessionHealth.refundedSessions} />
          <StatCard label="Flagged Sessions" value={data.sessionHealth.flaggedSessions} />
          <StatCard label="Completion Rate" value={percent(data.sessionHealth.completionRate)} />
          <StatCard label="No-show Rate" value={percent(data.sessionHealth.noShowRate)} />
        </div>
      </Section>

      <Section title="Earnings Flow" subtitle="Provider earnings derived from completed sessions (eligible only).">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Provider Earnings" value={money(data.earningsFlow.totalProviderEarningsCents)} />
          <StatCard label="Total Withdrawn" value={money(data.earningsFlow.totalWithdrawnCents)} />
          <StatCard label="Pending Payouts" value={money(data.earningsFlow.pendingPayoutsCents)} />
        </div>
      </Section>

      <Section title="Quality & Reviews" subtitle="Quality health from review submissions.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Average Provider Rating"
            value={data.qualityReviews.averageProviderRating ?? '—'}
            sub={data.qualityReviews.averageProviderRating ? 'Across all reviews' : 'No reviews yet'}
          />
          <StatCard label="Number of Reviews" value={data.qualityReviews.numberOfReviews} />
          <StatCard label="% of Sessions Reviewed" value={percent(data.qualityReviews.percentOfSessionsReviewed)} />
        </div>
      </Section>
    </div>
  );
}


