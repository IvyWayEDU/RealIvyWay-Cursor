import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getAdminStatistics } from '@/lib/admin/statistics.server';
import { getSessionsReadOnly } from '@/lib/sessions/storage';
import { getUsers } from '@/lib/auth/storage';
import { listAllPayoutRequests } from '@/lib/payouts/payout-requests.server';
import { handleApiError } from '@/lib/errorHandler';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';
import { readCredits } from '@/lib/earnings/credits.server';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function safeInt(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.floor(v);
}

function getProviderPayoutCents(session: any): number {
  try {
    const n = calculateProviderPayoutCentsFromSession(session as any);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return 0;
  }
}

function getGrossCents(session: any): number {
  try {
    const n = getSessionGrossCents(session as any);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return 0;
  }
}

function getPlatformRevenueCents(session: any): number {
  const ivy = safeInt(session?.ivyway_take_cents ?? 0);
  if (ivy > 0) return ivy;
  const pf = safeInt(session?.platformFeeCents ?? 0);
  if (pf > 0) return pf;
  return Math.max(0, getGrossCents(session) - getProviderPayoutCents(session));
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

function payoutRequestBucket(statusRaw: unknown): 'pending' | 'approved' | 'paid' | 'other' {
  const st = String(statusRaw || '').trim().toLowerCase();
  if (st === 'pending' || st === 'pending_admin_review') return 'pending';
  if (st === 'approved' || st === 'processing') return 'approved';
  if (st === 'paid' || st === 'completed') return 'paid';
  return 'other';
}

export async function GET(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  const { searchParams } = new URL(request.url);
  const exportKind = String(searchParams.get('export') || '').trim().toLowerCase();

  try {
    const stats = await getAdminStatistics({ months: 12 });

    if (exportKind === 'earnings') {
      const [users, sessions, payoutRequests] = await Promise.all([getUsers(), getSessionsReadOnly(), listAllPayoutRequests()]);
      const userById = new Map<string, any>((users as any[]).filter((u) => typeof u?.id === 'string').map((u) => [u.id, u]));

      const payoutTotalsByProvider = new Map<string, { sentCents: number; pendingCents: number }>();
      for (const pr of payoutRequests as any[]) {
        const providerId = typeof pr?.providerId === 'string' ? pr.providerId.trim() : '';
        if (!providerId) continue;
        const amt = Math.max(0, safeInt(pr?.amountCents ?? 0));
        const bucket = payoutRequestBucket(pr?.status);
        const cur = payoutTotalsByProvider.get(providerId) || { sentCents: 0, pendingCents: 0 };
        if (bucket === 'paid') cur.sentCents += amt;
        if (bucket === 'pending' || bucket === 'approved') cur.pendingCents += amt;
        payoutTotalsByProvider.set(providerId, cur);
      }

      const providerAgg = new Map<
        string,
        {
          providerId: string;
          providerName: string;
          providerEmail: string;
          sessionsCompleted: number;
          grossCents: number;
          platformRevenueCents: number;
          providerEarningsCents: number;
          payoutsSentCents: number;
          pendingPayoutsCents: number;
        }
      >();

      for (const s of sessions as any[]) {
        if (String(s?.status || '') !== 'completed') continue;
        const providerId = typeof s?.providerId === 'string' ? s.providerId.trim() : '';
        if (!providerId) continue;

        const u = userById.get(providerId);
        const providerName =
          (typeof s?.providerName === 'string' && s.providerName.trim()) ||
          (typeof u?.name === 'string' && String(u.name).trim()) ||
          (typeof u?.email === 'string' && String(u.email).trim()) ||
          providerId;
        const providerEmail = typeof u?.email === 'string' ? u.email : '';

        const grossCents = getGrossCents(s);
        const platformRevenueCents = getPlatformRevenueCents(s);
        const providerEarningsCents = getProviderPayoutCents(s);

        const existing = providerAgg.get(providerId) || {
          providerId,
          providerName,
          providerEmail,
          sessionsCompleted: 0,
          grossCents: 0,
          platformRevenueCents: 0,
          providerEarningsCents: 0,
          payoutsSentCents: 0,
          pendingPayoutsCents: 0,
        };

        existing.providerName = existing.providerName || providerName;
        existing.providerEmail = existing.providerEmail || providerEmail;
        existing.sessionsCompleted += 1;
        existing.grossCents += grossCents;
        existing.platformRevenueCents += platformRevenueCents;
        existing.providerEarningsCents += providerEarningsCents;
        providerAgg.set(providerId, existing);
      }

      // Overlay payout totals from financial truth (payout_requests).
      for (const [providerId, totals] of payoutTotalsByProvider.entries()) {
        const existing = providerAgg.get(providerId);
        if (existing) {
          existing.payoutsSentCents = totals.sentCents;
          existing.pendingPayoutsCents = totals.pendingCents;
          providerAgg.set(providerId, existing);
          continue;
        }
        const u = userById.get(providerId);
        providerAgg.set(providerId, {
          providerId,
          providerName:
            (typeof u?.name === 'string' && String(u.name).trim()) ||
            (typeof u?.email === 'string' && String(u.email).trim()) ||
            providerId,
          providerEmail: typeof u?.email === 'string' ? u.email : '',
          sessionsCompleted: 0,
          grossCents: 0,
          platformRevenueCents: 0,
          providerEarningsCents: 0,
          payoutsSentCents: totals.sentCents,
          pendingPayoutsCents: totals.pendingCents,
        });
      }

      const rows: Array<Array<unknown>> = [
        [
          'provider_id',
          'provider_name',
          'provider_email',
          'sessions_completed',
          'gross_usd',
          'gross_cents',
          'platform_revenue_usd',
          'platform_revenue_cents',
          'provider_earnings_usd',
          'provider_earnings_cents',
          'payouts_sent_usd',
          'payouts_sent_cents',
          'pending_payouts_usd',
          'pending_payouts_cents',
        ],
      ];

      const all = Array.from(providerAgg.values()).sort(
        (a, b) => (b.platformRevenueCents - a.platformRevenueCents) || (b.providerEarningsCents - a.providerEarningsCents)
      );

      let totSessions = 0;
      let totGross = 0;
      let totPlatform = 0;
      let totProvider = 0;
      let totSent = 0;
      let totPending = 0;

      for (const r of all) {
        rows.push([
          r.providerId,
          r.providerName,
          r.providerEmail,
          r.sessionsCompleted,
          money(r.grossCents),
          r.grossCents,
          money(r.platformRevenueCents),
          r.platformRevenueCents,
          money(r.providerEarningsCents),
          r.providerEarningsCents,
          money(r.payoutsSentCents),
          r.payoutsSentCents,
          money(r.pendingPayoutsCents),
          r.pendingPayoutsCents,
        ]);
        totSessions += r.sessionsCompleted;
        totGross += r.grossCents;
        totPlatform += r.platformRevenueCents;
        totProvider += r.providerEarningsCents;
        totSent += r.payoutsSentCents;
        totPending += r.pendingPayoutsCents;
      }

      rows.push([
        'TOTAL',
        '',
        '',
        totSessions,
        money(totGross),
        totGross,
        money(totPlatform),
        totPlatform,
        money(totProvider),
        totProvider,
        money(totSent),
        totSent,
        money(totPending),
        totPending,
      ]);

      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ivyway-earnings.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (exportKind === 'sessions') {
      // Export session-level rows (useful for owners to pivot in Excel).
      const [sessions, payoutRequests, credits] = await Promise.all([
        getSessionsReadOnly(),
        listAllPayoutRequests(),
        readCredits(),
      ]);

      const creditedSessionIds = new Set<string>(
        (credits as any[]).map((c) => String((c as any)?.sessionId || '').trim()).filter(Boolean)
      );
      const sessionPayoutFlags = new Map<string, { hasPaid: boolean; hasPending: boolean }>();
      for (const pr of payoutRequests as any[]) {
        const bucket = payoutRequestBucket(pr?.status);
        if (bucket !== 'paid' && bucket !== 'pending' && bucket !== 'approved') continue;
        const allocs = Array.isArray(pr?.allocations) ? (pr.allocations as any[]) : [];
        if (allocs.length === 0) continue;
        for (const a of allocs) {
          const sessionId = String(a?.sessionId || '').trim();
          if (!sessionId) continue;
          const cur = sessionPayoutFlags.get(sessionId) || { hasPaid: false, hasPending: false };
          if (bucket === 'paid') cur.hasPaid = true;
          if (bucket === 'pending' || bucket === 'approved') cur.hasPending = true;
          sessionPayoutFlags.set(sessionId, cur);
        }
      }

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

      for (const s of sessions as any[]) {
        const grossCents = getGrossCents(s);
        const providerPayoutCents = (() => {
          try {
            const n = calculateProviderPayoutCentsFromSession(s as any);
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

        const sessionId = String(s?.id ?? '').trim();
        const flags = sessionId ? sessionPayoutFlags.get(sessionId) : null;
        const financialPayoutStatus =
          flags?.hasPaid === true
            ? 'paid'
            : flags?.hasPending === true
              ? 'pending_payout'
              : sessionId && creditedSessionIds.has(sessionId)
                ? 'available'
                : '';

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
          financialPayoutStatus,
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

    if (exportKind === 'payouts') {
      const [users, payoutRequests] = await Promise.all([getUsers(), listAllPayoutRequests()]);
      const userById = new Map<string, any>((users as any[]).filter((u) => typeof u?.id === 'string').map((u) => [u.id, u]));

      const rows: Array<Array<unknown>> = [
        [
          'payout_request_id',
          'provider_id',
          'provider_name',
          'provider_email',
          'amount_usd',
          'amount_cents',
          'status',
          'created_at',
          'approved_at',
          'paid_at',
          'payout_method',
          'payout_destination_masked',
        ],
      ];

      for (const pr of payoutRequests as any[]) {
        const providerId = typeof pr?.providerId === 'string' ? pr.providerId : '';
        const u = providerId ? userById.get(providerId) : null;
        const providerName =
          (typeof u?.name === 'string' && u.name.trim()) ||
          (typeof u?.email === 'string' && u.email.trim()) ||
          providerId ||
          '';
        const providerEmail = typeof u?.email === 'string' ? u.email : '';
        const amountCents = Math.max(0, safeInt(pr?.amountCents ?? 0));
        rows.push([
          pr?.id ?? '',
          providerId,
          providerName,
          providerEmail,
          money(amountCents),
          amountCents,
          pr?.status ?? '',
          pr?.createdAt ?? '',
          pr?.approvedAt ?? '',
          pr?.paidAt ?? '',
          pr?.payoutMethod ?? '',
          pr?.payoutDestinationMasked ?? pr?.payoutDestination ?? '',
        ]);
      }

      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ivyway-payouts.csv"`,
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
    return handleApiError(error, { logPrefix: '[api/admin/statistics]' });
  }
}


