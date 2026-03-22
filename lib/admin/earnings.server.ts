import 'server-only';

import { getUsers } from '@/lib/auth/storage';
import { getProviders } from '@/lib/providers/storage';
import { getSessions } from '@/lib/sessions/storage';
import { listAllPayoutRequests, type PayoutRequest } from '@/lib/payouts/payout-requests.server';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import type { Session } from '@/lib/models/types';
import type { User } from '@/lib/auth/types';

export type AdminEarningsServiceType = 'tutoring' | 'test_prep' | 'virtual_tour' | 'college_counseling';

export type AdminEarningsAnalytics = {
  generatedAt: string;
  totals: {
    lifetimeGrossRevenueCents: number;
    platformRevenueCents: number;
    providerRevenueCents: number;
    totalPaidOutCents: number;
    pendingPayoutsCents: number;
    availableProviderEarningsCents: number;
    totalSessionsBooked: number;
    completedSessions: number;
    avgRevenuePerSessionCents: number;
    avgPlatformRevenuePerSessionCents: number;
  };
  revenueByType: Array<{
    type: AdminEarningsServiceType;
    bookings: number;
    grossRevenueCents: number;
    providerRevenueCents: number;
    platformRevenueCents: number;
    avgBookingValueCents: number;
    bookingsPct: number; // 0..100
    grossRevenuePct: number; // 0..100
  }>;
  rankings: {
    mostBooked: AdminEarningsServiceType | null;
    leastBooked: AdminEarningsServiceType | null;
    highestGrossRevenue: AdminEarningsServiceType | null;
    lowestGrossRevenue: AdminEarningsServiceType | null;
    bookingsPctByType: Record<AdminEarningsServiceType, number>;
  };
  payoutAnalytics: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    paidRequests: number;
    avgRequestAmountCents: number;
    largestRequestCents: number;
    smallestRequestCents: number;
    providerTotals: Array<{
      providerId: string;
      providerName: string;
      providerEmail: string;
      pendingCents: number;
      approvedCents: number;
      paidCents: number;
      totalRequestedCents: number;
    }>;
  };
  providerLeaderboard: Array<{
    providerId: string;
    providerName: string;
    email: string;
    completedSessions: number;
    totalEarningsCents: number;
    pendingPayoutsCents: number;
    totalPaidOutCents: number;
    availableBalanceCents: number;
  }>;
  monthly: Array<{
    month: string; // YYYY-MM
    label: string; // e.g. "Mar 2026"
    grossRevenueCents: number;
    platformRevenueCents: number;
    providerRevenueCents: number;
    paidOutCents: number;
    pendingPayoutsCents: number;
    sessionCount: number;
  }>;
  recentActivity: Array<{
    at: string; // ISO
    type: 'completed_session' | 'payout_request' | 'payout_approved' | 'payout_paid';
    providerId?: string;
    providerName?: string;
    providerEmail?: string;
    sessionType?: AdminEarningsServiceType;
    amountCents: number;
    status: string;
    refId?: string;
  }>;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function safeIso(v: unknown): string | null {
  if (!isNonEmptyString(v)) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function clampCents(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function getSessionCollectedCents(session: Session): number {
  const charged = clampCents((session as any)?.amountChargedCents);
  const totalCharge = clampCents((session as any)?.total_charge_cents);
  const fallback = clampCents((session as any)?.priceCents);
  const refunded = clampCents((session as any)?.amountRefundedCents);

  const gross = totalCharge || charged || fallback || 0;
  return Math.max(0, gross - refunded);
}

function normalizeServiceType(session: Session): AdminEarningsServiceType | null {
  const raw =
    (session as any)?.service_type ??
    (session as any)?.serviceType ??
    (session as any)?.serviceTypeId ??
    (session as any)?.sessionType ??
    '';
  const v = String(raw || '').trim().toLowerCase().replace(/-/g, '_');
  if (v === 'tutoring') return 'tutoring';
  if (v === 'test_prep' || v === 'testprep') return 'test_prep';
  if (v === 'virtual_tour' || v === 'virtual_tours' || v === 'virtual_tour_single') return 'virtual_tour';
  if (v === 'college_counseling' || v === 'counseling') return 'college_counseling';
  return null;
}

function isBookedSession(session: Session): boolean {
  const status = String((session as any)?.status || '').trim().toLowerCase();
  if (status === 'available') return false;
  const isPaid = (session as any)?.isPaid === true;
  const bookedAt = safeIso((session as any)?.bookedAt);
  const hasIntent = isNonEmptyString((session as any)?.stripePaymentIntentId);
  return isPaid || !!bookedAt || hasIntent;
}

function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map((p) => Number(p));
  const d = new Date(Date.UTC(y || 1970, Math.max(0, (m || 1) - 1), 1));
  return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

function lastNMonthKeys(now: Date, n: number): string[] {
  const out: string[] = [];
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out.reverse();
}

function pct(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return (n / d) * 100;
}

function sumCents(values: number[]): number {
  let t = 0;
  for (const v of values) t += clampCents(v);
  return t;
}

function payoutStatusBucket(st: unknown): 'pending' | 'approved' | 'paid' | 'other' {
  const v = String(st || '').trim().toLowerCase();
  if (v === 'pending' || v === 'pending_admin_review') return 'pending';
  if (v === 'approved' || v === 'processing') return 'approved';
  if (v === 'paid' || v === 'completed') return 'paid';
  return 'other';
}

export async function getAdminEarningsAnalytics(): Promise<AdminEarningsAnalytics> {
  const [users, providers, sessions, payoutRequests] = await Promise.all([
    getUsers(),
    getProviders(),
    getSessions(),
    listAllPayoutRequests(),
  ]);

  const userById = new Map<string, User>((users || []).map((u) => [u.id, u]));

  const bookedSessions = (sessions || []).filter(isBookedSession);
  const completedSessions = (sessions || []).filter((s) => String((s as any)?.status || '') === 'completed');

  // Gross revenue = sum of successful student payments (net of refunds when present).
  const lifetimeGrossRevenueCents = sumCents(bookedSessions.map(getSessionCollectedCents));

  // Provider revenue = sum of provider earnings from completed sessions (source of truth).
  const providerRevenueCents = sumCents(completedSessions.map((s) => calculateProviderPayoutCentsFromSession(s)));

  // Platform revenue = gross revenue - provider revenue (per spec).
  const platformRevenueCents = Math.max(0, lifetimeGrossRevenueCents - providerRevenueCents);

  // Payout requests totals (per spec).
  const pendingPayoutsCents = sumCents(
    (payoutRequests || [])
      .filter((r) => {
        const bucket = payoutStatusBucket(r.status);
        return bucket === 'pending' || bucket === 'approved';
      })
      .map((r) => Number(r.amountCents || 0))
  );
  const totalPaidOutCents = sumCents(
    (payoutRequests || [])
      .filter((r) => payoutStatusBucket(r.status) === 'paid')
      .map((r) => Number(r.amountCents || 0))
  );
  const availableProviderEarningsCents = Math.max(0, providerRevenueCents - pendingPayoutsCents - totalPaidOutCents);

  const totalSessionsBooked = bookedSessions.length;
  const completedSessionCount = completedSessions.length;
  const avgRevenuePerSessionCents = totalSessionsBooked > 0 ? Math.floor(lifetimeGrossRevenueCents / totalSessionsBooked) : 0;
  const avgPlatformRevenuePerSessionCents = totalSessionsBooked > 0 ? Math.floor(platformRevenueCents / totalSessionsBooked) : 0;

  const allTypes: AdminEarningsServiceType[] = ['tutoring', 'test_prep', 'virtual_tour', 'college_counseling'];
  const byType = new Map<AdminEarningsServiceType, { bookings: number; gross: number; provider: number }>(
    allTypes.map((t) => [t, { bookings: 0, gross: 0, provider: 0 }])
  );

  for (const s of bookedSessions) {
    const t = normalizeServiceType(s);
    if (!t) continue;
    const entry = byType.get(t)!;
    entry.bookings += 1;
    entry.gross += getSessionCollectedCents(s);
  }

  for (const s of completedSessions) {
    const t = normalizeServiceType(s);
    if (!t) continue;
    const entry = byType.get(t)!;
    entry.provider += calculateProviderPayoutCentsFromSession(s);
  }

  const revenueByType = allTypes.map((t) => {
    const entry = byType.get(t)!;
    const platform = Math.max(0, entry.gross - entry.provider);
    const avg = entry.bookings > 0 ? Math.floor(entry.gross / entry.bookings) : 0;
    return {
      type: t,
      bookings: entry.bookings,
      grossRevenueCents: entry.gross,
      providerRevenueCents: entry.provider,
      platformRevenueCents: platform,
      avgBookingValueCents: avg,
      bookingsPct: pct(entry.bookings, totalSessionsBooked),
      grossRevenuePct: pct(entry.gross, lifetimeGrossRevenueCents),
    };
  });

  const rankMost = [...revenueByType].sort((a, b) => b.bookings - a.bookings);
  const rankGross = [...revenueByType].sort((a, b) => b.grossRevenueCents - a.grossRevenueCents);

  const mostBooked = rankMost.length ? rankMost[0].type : null;
  const leastBooked = rankMost.length ? rankMost[rankMost.length - 1].type : null;
  const highestGrossRevenue = rankGross.length ? rankGross[0].type : null;
  const lowestGrossRevenue = rankGross.length ? rankGross[rankGross.length - 1].type : null;

  const bookingsPctByType: Record<AdminEarningsServiceType, number> = {
    tutoring: pct(byType.get('tutoring')!.bookings, totalSessionsBooked),
    test_prep: pct(byType.get('test_prep')!.bookings, totalSessionsBooked),
    virtual_tour: pct(byType.get('virtual_tour')!.bookings, totalSessionsBooked),
    college_counseling: pct(byType.get('college_counseling')!.bookings, totalSessionsBooked),
  };

  // Payout analytics (counts + provider totals).
  const payoutAmounts = (payoutRequests || []).map((r) => clampCents(r.amountCents));
  const payoutTotal = sumCents(payoutAmounts);
  const payoutAnalytics = {
    totalRequests: (payoutRequests || []).length,
    pendingRequests: (payoutRequests || []).filter((r) => payoutStatusBucket(r.status) === 'pending').length,
    approvedRequests: (payoutRequests || []).filter((r) => payoutStatusBucket(r.status) === 'approved').length,
    paidRequests: (payoutRequests || []).filter((r) => payoutStatusBucket(r.status) === 'paid').length,
    avgRequestAmountCents: (payoutRequests || []).length > 0 ? Math.floor(payoutTotal / (payoutRequests || []).length) : 0,
    largestRequestCents: payoutAmounts.length ? Math.max(...payoutAmounts) : 0,
    smallestRequestCents: payoutAmounts.length ? Math.min(...payoutAmounts) : 0,
    providerTotals: [] as AdminEarningsAnalytics['payoutAnalytics']['providerTotals'],
  };

  const payoutByProvider = new Map<
    string,
    { pending: number; approved: number; paid: number; total: number }
  >();
  for (const r of payoutRequests || []) {
    const providerId = String(r.providerId || '').trim();
    if (!providerId) continue;
    const bucket = payoutStatusBucket(r.status);
    const amount = clampCents(r.amountCents);
    const entry = payoutByProvider.get(providerId) || { pending: 0, approved: 0, paid: 0, total: 0 };
    entry.total += amount;
    if (bucket === 'pending') entry.pending += amount;
    if (bucket === 'approved') entry.approved += amount;
    if (bucket === 'paid') entry.paid += amount;
    payoutByProvider.set(providerId, entry);
  }
  payoutAnalytics.providerTotals = Array.from(payoutByProvider.entries())
    .map(([providerId, t]) => {
      const u = userById.get(providerId);
      return {
        providerId,
        providerName: u?.name || u?.email || providerId,
        providerEmail: u?.email || '',
        pendingCents: t.pending,
        approvedCents: t.approved,
        paidCents: t.paid,
        totalRequestedCents: t.total,
      };
    })
    .sort((a, b) => b.totalRequestedCents - a.totalRequestedCents);

  // Provider earnings leaderboard (top by total earnings).
  const completedByProvider = new Map<string, { count: number; earnings: number }>();
  for (const s of completedSessions) {
    const providerId = String((s as any)?.providerId || '').trim();
    if (!providerId) continue;
    const entry = completedByProvider.get(providerId) || { count: 0, earnings: 0 };
    entry.count += 1;
    entry.earnings += calculateProviderPayoutCentsFromSession(s);
    completedByProvider.set(providerId, entry);
  }

  const providerLeaderboard = (providers || [])
    .map((p) => {
      const providerId = String((p as any)?.userId || '').trim();
      const u = providerId ? userById.get(providerId) : undefined;
      const completed = completedByProvider.get(providerId) || { count: 0, earnings: 0 };
      const payoutTotals = payoutByProvider.get(providerId) || { pending: 0, approved: 0, paid: 0, total: 0 };
      const pending = payoutTotals.pending + payoutTotals.approved;
      const paid = payoutTotals.paid;
      const available = Math.max(0, completed.earnings - pending - paid);
      return {
        providerId,
        providerName: u?.name || u?.email || (p as any)?.displayName || providerId,
        email: u?.email || '',
        completedSessions: completed.count,
        totalEarningsCents: completed.earnings,
        pendingPayoutsCents: pending,
        totalPaidOutCents: paid,
        availableBalanceCents: available,
      };
    })
    .filter((r) => !!r.providerId)
    .sort((a, b) => b.totalEarningsCents - a.totalEarningsCents);

  // Monthly trend (last 12 months)
  const months = lastNMonthKeys(new Date(), 12);
  const bookedAtIso = (s: Session): string | null =>
    safeIso((s as any)?.bookedAt) || safeIso((s as any)?.paidAt) || safeIso((s as any)?.createdAt) || null;

  const grossByMonth = new Map<string, number>();
  const bookedCountByMonth = new Map<string, number>();
  const providerByMonth = new Map<string, number>();

  for (const s of bookedSessions) {
    const at = bookedAtIso(s);
    if (!at) continue;
    const mk = monthKeyFromIso(at);
    grossByMonth.set(mk, (grossByMonth.get(mk) || 0) + getSessionCollectedCents(s));
    bookedCountByMonth.set(mk, (bookedCountByMonth.get(mk) || 0) + 1);
    if (String((s as any)?.status || '') === 'completed') {
      providerByMonth.set(mk, (providerByMonth.get(mk) || 0) + calculateProviderPayoutCentsFromSession(s));
    }
  }

  const paidOutByMonth = new Map<string, number>();
  const pendingReqByMonth = new Map<string, number>();
  for (const r of payoutRequests || []) {
    const bucket = payoutStatusBucket(r.status);
    const amount = clampCents(r.amountCents);
    if (bucket === 'paid') {
      const at = safeIso((r as any).paidAt) || safeIso((r as any).updatedAt) || safeIso((r as any).createdAt);
      if (!at) continue;
      const mk = monthKeyFromIso(at);
      paidOutByMonth.set(mk, (paidOutByMonth.get(mk) || 0) + amount);
    }
    if (bucket === 'pending' || bucket === 'approved') {
      const at = safeIso((r as any).createdAt) || safeIso((r as any).updatedAt) || safeIso((r as any).paidAt);
      if (!at) continue;
      const mk = monthKeyFromIso(at);
      pendingReqByMonth.set(mk, (pendingReqByMonth.get(mk) || 0) + amount);
    }
  }

  const monthly = months.map((m) => {
    const gross = clampCents(grossByMonth.get(m) || 0);
    const provider = clampCents(providerByMonth.get(m) || 0);
    const platform = Math.max(0, gross - provider);
    return {
      month: m,
      label: monthLabelFromKey(m),
      grossRevenueCents: gross,
      platformRevenueCents: platform,
      providerRevenueCents: provider,
      paidOutCents: clampCents(paidOutByMonth.get(m) || 0),
      pendingPayoutsCents: clampCents(pendingReqByMonth.get(m) || 0),
      sessionCount: Math.max(0, Math.floor(bookedCountByMonth.get(m) || 0)),
    };
  });

  // Recent activity feed
  const recent: AdminEarningsAnalytics['recentActivity'] = [];

  for (const s of completedSessions) {
    const at = safeIso((s as any)?.completedAt) || safeIso((s as any)?.updatedAt) || safeIso((s as any)?.endTime) || null;
    if (!at) continue;
    const providerId = String((s as any)?.providerId || '').trim();
    const u = providerId ? userById.get(providerId) : undefined;
    recent.push({
      at,
      type: 'completed_session',
      providerId: providerId || undefined,
      providerName: (s as any)?.providerName || u?.name || u?.email || providerId || undefined,
      providerEmail: u?.email || undefined,
      sessionType: normalizeServiceType(s) || undefined,
      amountCents: calculateProviderPayoutCentsFromSession(s),
      status: 'earned',
      refId: String((s as any)?.id || ''),
    });
  }

  const pushPayoutEvent = (r: PayoutRequest, kind: AdminEarningsAnalytics['recentActivity'][number]['type'], at: string, status: string) => {
    const providerId = String(r.providerId || '').trim();
    const u = providerId ? userById.get(providerId) : undefined;
    recent.push({
      at,
      type: kind,
      providerId: providerId || undefined,
      providerName: u?.name || u?.email || providerId || undefined,
      providerEmail: u?.email || undefined,
      amountCents: clampCents(r.amountCents),
      status,
      refId: String(r.id || ''),
    });
  };

  for (const r of payoutRequests || []) {
    const created = safeIso(r.createdAt);
    if (created) pushPayoutEvent(r, 'payout_request', created, String(r.status || 'pending'));
    const approved = safeIso((r as any).approvedAt);
    if (approved) pushPayoutEvent(r, 'payout_approved', approved, 'approved');
    const paid = safeIso((r as any).paidAt);
    if (paid) pushPayoutEvent(r, 'payout_paid', paid, 'paid');
  }

  recent.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      lifetimeGrossRevenueCents,
      platformRevenueCents,
      providerRevenueCents,
      totalPaidOutCents,
      pendingPayoutsCents,
      availableProviderEarningsCents,
      totalSessionsBooked,
      completedSessions: completedSessionCount,
      avgRevenuePerSessionCents,
      avgPlatformRevenuePerSessionCents,
    },
    revenueByType,
    rankings: {
      mostBooked,
      leastBooked,
      highestGrossRevenue,
      lowestGrossRevenue,
      bookingsPctByType,
    },
    payoutAnalytics,
    providerLeaderboard,
    monthly,
    recentActivity: recent.slice(0, 40),
  };
}

