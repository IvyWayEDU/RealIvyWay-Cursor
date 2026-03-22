import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/errorHandler';
import { getAdminReconciliation } from '@/lib/admin/reconciliation.server';

function safeInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

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
  const days = safeInt(searchParams.get('days') || 30);

  try {
    const data = await getAdminReconciliation({ days });

    if (exportKind === 'csv') {
      const t = data.totals;
      const rows: Array<Array<unknown>> = [
        ['generated_at', data.generatedAt],
        ['days', data.daily.days],
        [],
        ['metric', 'amount_usd', 'amount_cents'],
        ['total_student_payments_received', money(t.totalStudentPaymentsReceivedCents), t.totalStudentPaymentsReceivedCents],
        ['total_platform_revenue', money(t.totalPlatformRevenueCents), t.totalPlatformRevenueCents],
        ['total_provider_earnings', money(t.totalProviderEarningsCents), t.totalProviderEarningsCents],
        ['total_payouts_sent', money(t.totalPayoutsSentCents), t.totalPayoutsSentCents],
        ['total_pending_payouts', money(t.totalPendingPayoutsCents), t.totalPendingPayoutsCents],
        [],
        ['balance_check', 'student_payments - provider_earnings - platform_revenue'],
        [
          data.balanceCheck.ok ? 'ok' : 'mismatch',
          money(data.balanceCheck.studentPaymentsMinusProviderMinusPlatformCents),
        ],
        [],
        ['date', 'daily_revenue_usd', 'daily_revenue_cents', 'daily_payouts_usd', 'daily_payouts_cents', 'daily_bookings'],
      ];

      for (let i = 0; i < data.daily.dateKeys.length; i++) {
        const day = data.daily.dateKeys[i] || '';
        const rev = data.daily.dailyRevenueCents[i] || 0;
        const pay = data.daily.dailyPayoutsCents[i] || 0;
        const bookings = data.daily.dailyBookings[i] || 0;
        rows.push([day, money(rev), rev, money(pay), pay, bookings]);
      }

      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ivyway-financial-reconciliation.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/reconciliation]' });
  }
}

