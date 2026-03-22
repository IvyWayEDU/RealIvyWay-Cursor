import 'server-only';

import { getSessions } from '@/lib/sessions/storage';
import { listAllPayoutRequests, type PayoutRequest } from '@/lib/payouts/payout-requests.server';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';

export type AdminReconciliation = {
  generatedAt: string; // ISO
  totals: {
    totalStudentPaymentsReceivedCents: number;
    totalPlatformRevenueCents: number;
    totalProviderEarningsCents: number;
    totalPayoutsSentCents: number;
    totalPendingPayoutsCents: number;
  };
  balanceCheck: {
    studentPaymentsMinusProviderMinusPlatformCents: number;
    ok: boolean;
  };
  daily: {
    days: number;
    dateKeys: string[]; // YYYY-MM-DD (UTC)
    dailyRevenueCents: number[];
    dailyPayoutsCents: number[];
    dailyBookings: number[];
  };
};

function safeInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

function isoDayKey(iso: unknown): string | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function addDaysUtc(dayKey: string, deltaDays: number): string {
  const t = new Date(`${dayKey}T00:00:00.000Z`).getTime();
  const next = t + deltaDays * 86400_000;
  return new Date(next).toISOString().slice(0, 10);
}

function dayKeysBackFromNow(days: number, nowMs: number): string[] {
  const count = Math.max(7, Math.min(365, Math.floor(days || 30)));
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const start = addDaysUtc(today, -(count - 1));
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    cur = addDaysUtc(cur, 1);
  }
  return out;
}

function getCompletedAtIsoForSession(s: any): string | null {
  return typeof s?.completedAt === 'string'
    ? s.completedAt
    : typeof s?.updatedAt === 'string'
      ? s.updatedAt
      : typeof s?.endTime === 'string'
        ? s.endTime
        : typeof s?.scheduledEndTime === 'string'
          ? s.scheduledEndTime
          : null;
}

function getBookedAtIsoForSession(s: any): string | null {
  return typeof s?.bookedAt === 'string'
    ? s.bookedAt
    : typeof s?.createdAt === 'string'
      ? s.createdAt
      : null;
}

function getPlatformRevenueCents(session: any, providerEarningsCents: number): number {
  const ivy = safeInt(session?.ivyway_take_cents);
  if (ivy > 0) return ivy;
  const pf = safeInt(session?.platformFeeCents);
  if (pf > 0) return pf;
  const gross = Math.max(0, getSessionGrossCents(session as any));
  return Math.max(0, gross - Math.max(0, providerEarningsCents));
}

function payoutRequestIsPaid(pr: PayoutRequest): boolean {
  const st = String(pr?.status || '');
  return st === 'paid' || st === 'completed';
}

function payoutRequestIsPending(pr: PayoutRequest): boolean {
  const st = String(pr?.status || '');
  return st === 'pending' || st === 'approved' || st === 'pending_admin_review' || st === 'processing';
}

export async function getAdminReconciliation(args?: { days?: number }): Promise<AdminReconciliation> {
  const nowMs = Date.now();
  const days = Math.max(7, Math.min(365, Math.floor(args?.days ?? 30)));

  const [sessions, payoutRequests] = await Promise.all([getSessions(), listAllPayoutRequests()]);
  const allSessions = sessions as any[];

  let totalStudentPaymentsReceivedCents = 0;
  let totalPlatformRevenueCents = 0;
  let totalProviderEarningsCents = 0;

  const dailyRevenueByDay = new Map<string, number>();
  const dailyBookingsByDay = new Map<string, number>();

  for (const s of allSessions) {
    const bookedDay = isoDayKey(getBookedAtIsoForSession(s));
    if (bookedDay) dailyBookingsByDay.set(bookedDay, (dailyBookingsByDay.get(bookedDay) || 0) + 1);

    if (String(s?.status || '') !== 'completed') continue;

    const gross = Math.max(0, getSessionGrossCents(s as any));
    const eligible = Boolean(s?.providerEligibleForPayout === true);
    const provider = eligible ? Math.max(0, calculateProviderPayoutCentsFromSession(s as any)) : 0;
    const platform = Math.max(0, getPlatformRevenueCents(s, provider));

    totalStudentPaymentsReceivedCents += gross;
    totalPlatformRevenueCents += platform;
    totalProviderEarningsCents += provider;

    const completedDay = isoDayKey(getCompletedAtIsoForSession(s));
    if (completedDay) dailyRevenueByDay.set(completedDay, (dailyRevenueByDay.get(completedDay) || 0) + platform);
  }

  let totalPayoutsSentCents = 0;
  let totalPendingPayoutsCents = 0;
  const dailyPayoutsByDay = new Map<string, number>();

  for (const pr of payoutRequests as any[]) {
    const amt = Math.max(0, safeInt((pr as any)?.amountCents));
    if (payoutRequestIsPaid(pr)) {
      totalPayoutsSentCents += amt;
      const paidDay = isoDayKey((pr as any)?.paidAt || (pr as any)?.updatedAt || (pr as any)?.createdAt);
      if (paidDay) dailyPayoutsByDay.set(paidDay, (dailyPayoutsByDay.get(paidDay) || 0) + amt);
    } else if (payoutRequestIsPending(pr)) {
      totalPendingPayoutsCents += amt;
    }
  }

  const discrepancy = totalStudentPaymentsReceivedCents - totalProviderEarningsCents - totalPlatformRevenueCents;

  const dateKeys = dayKeysBackFromNow(days, nowMs);
  const dailyRevenueCents = dateKeys.map((d) => dailyRevenueByDay.get(d) || 0);
  const dailyPayoutsCents = dateKeys.map((d) => dailyPayoutsByDay.get(d) || 0);
  const dailyBookings = dateKeys.map((d) => dailyBookingsByDay.get(d) || 0);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    totals: {
      totalStudentPaymentsReceivedCents,
      totalPlatformRevenueCents,
      totalProviderEarningsCents,
      totalPayoutsSentCents,
      totalPendingPayoutsCents,
    },
    balanceCheck: {
      studentPaymentsMinusProviderMinusPlatformCents: discrepancy,
      ok: discrepancy === 0,
    },
    daily: {
      days,
      dateKeys,
      dailyRevenueCents,
      dailyPayoutsCents,
      dailyBookings,
    },
  };
}

