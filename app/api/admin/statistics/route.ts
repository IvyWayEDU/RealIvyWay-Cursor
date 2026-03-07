import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getAdminStatistics } from '@/lib/admin/statistics.server';
import { getSessions } from '@/lib/sessions/storage';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

export async function GET(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  const { searchParams } = new URL(request.url);
  const exportKind = String(searchParams.get('export') || '').trim().toLowerCase();

  try {
    const stats = await getAdminStatistics({ months: 12 });

    if (exportKind === 'revenue') {
      const rows: Array<Array<unknown>> = [
        ['service_type', 'revenue_usd', 'revenue_cents', 'percent_of_total'],
      ];
      for (const r of stats.revenueOverview.byService) {
        rows.push([r.serviceType, money(r.revenueCents), r.revenueCents, (r.percentOfTotal * 100).toFixed(2)]);
      }
      rows.push([
        'TOTAL',
        money(stats.revenueOverview.totalRevenueCents),
        stats.revenueOverview.totalRevenueCents,
        '100.00',
      ]);

      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ivyway-revenue.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (exportKind === 'sessions') {
      // Export session-level rows (useful for owners to pivot in Excel).
      const sessions = (await getSessions()) as any[];
      const rows: Array<Array<unknown>> = [
        [
          'id',
          'service_type',
          'status',
          'booked_at',
          'scheduled_start',
          'scheduled_end',
          'student_id',
          'provider_id',
          'gross_cents',
          'platform_revenue_cents',
          'provider_payout_cents',
          'amount_refunded_cents',
          'payout_status',
          'flag',
        ],
      ];

      for (const s of sessions) {
        const grossCents = (() => {
          try {
            const n = Number(s?.session_price_cents ?? s?.priceCents ?? s?.amountChargedCents ?? 0);
            return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
          } catch {
            return 0;
          }
        })();
        const providerPayoutCents = (() => {
          try {
            const n = Number(s?.provider_payout_cents ?? s?.providerPayoutCents ?? 0);
            return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
          } catch {
            return 0;
          }
        })();
        const platformRevenueCents = (() => {
          const ivy = Number(s?.ivyway_take_cents ?? 0);
          if (Number.isFinite(ivy) && ivy > 0) return Math.floor(ivy);
          const pf = Number(s?.platformFeeCents ?? 0);
          if (Number.isFinite(pf) && pf > 0) return Math.floor(pf);
          return Math.max(0, Math.floor(grossCents - providerPayoutCents));
        })();

        rows.push([
          s?.id ?? '',
          s?.serviceType ?? s?.service_type ?? s?.serviceTypeId ?? s?.sessionType ?? '',
          s?.status ?? '',
          s?.bookedAt ?? '',
          s?.scheduledStartTime ?? s?.scheduledStart ?? s?.startTime ?? '',
          s?.scheduledEndTime ?? s?.scheduledEnd ?? s?.endTime ?? '',
          s?.studentId ?? '',
          s?.providerId ?? '',
          grossCents,
          platformRevenueCents,
          providerPayoutCents,
          Number(s?.amountRefundedCents ?? 0) || 0,
          s?.payoutStatus ?? '',
          s?.flag ?? '',
        ]);
      }

      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ivyway-sessions.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Default JSON response
    return NextResponse.json(stats, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[ADMIN STATISTICS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


