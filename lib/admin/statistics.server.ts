import 'server-only';

import { getUsers } from '@/lib/auth/storage';
import { getSessions } from '@/lib/sessions/storage';
import { getReviews } from '@/lib/reviews/storage.server';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';

type CanonicalServiceType = 'tutoring' | 'test_prep' | 'college_counseling' | 'virtual_tour';

export type AdminStatistics = {
  generatedAt: string; // ISO

  revenueOverview: {
    totalRevenueCents: number;
    revenueThisMonthCents: number;
    revenueLastMonthCents: number;
    byService: Array<{
      serviceType: CanonicalServiceType;
      revenueCents: number;
      percentOfTotal: number; // 0..1
    }>;
  };

  servicePopularity: {
    sessionsByService: Array<{ serviceType: CanonicalServiceType; sessionCount: number }>;
  };

  userGrowth: {
    totals: {
      totalStudents: number;
      totalProviders: number;
      totalCounselors: number;
      totalTutors: number;
    };
    signupsPerMonth: Array<{
      month: string; // YYYY-MM
      studentSignups: number;
      providerSignups: number;
    }>;
  };

  sessionHealth: {
    totalSessionsBooked: number;
    sessionsCompleted: number;
    sessionsNoShowProvider: number;
    sessionsNoShowStudent: number;
    refundedSessions: number;
    flaggedSessions: number;
    completionRate: number; // 0..1
    noShowRate: number; // 0..1 (any no-show / total)
  };

  earningsFlow: {
    totalProviderEarningsCents: number;
    totalWithdrawnCents: number;
    pendingPayoutsCents: number;
  };

  qualityReviews: {
    averageProviderRating: number | null;
    numberOfReviews: number;
    percentOfSessionsReviewed: number; // 0..1
  };
};

function safeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function monthKeyFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 7);
}

function getServiceType(session: any): CanonicalServiceType | null {
  const raw =
    String(
      session?.serviceType ??
        session?.service_type ??
        session?.serviceTypeId ??
        session?.sessionType ??
        ''
    )
      .trim()
      .toLowerCase();

  const v = raw.replace(/-/g, '_');

  if (v === 'tutoring') return 'tutoring';
  if (v === 'test_prep' || v === 'testprep') return 'test_prep';
  if (v === 'college_counseling' || v === 'college_counselling' || v === 'counseling' || v === 'counselling')
    return 'college_counseling';
  if (v === 'virtual_tour' || v === 'virtual_tours' || v === 'virtualtour') return 'virtual_tour';

  return null;
}

function getPlatformRevenueCents(session: any): number {
  // Prefer canonical fields already present on session records.
  const ivywayTake = safeNumber(session?.ivyway_take_cents);
  if (ivywayTake > 0) return Math.floor(ivywayTake);

  const platformFee = safeNumber(session?.platformFeeCents);
  if (platformFee > 0) return Math.floor(platformFee);

  // Fallback: derive from gross - provider payout (both in cents).
  try {
    const gross = getSessionGrossCents(session as any);
    const provider = calculateProviderPayoutCentsFromSession(session as any);
    return Math.max(0, Math.floor(gross - provider));
  } catch {
    return 0;
  }
}

function isStudentUser(u: any): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && roles.includes('student');
}

function isTutorUser(u: any): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && roles.includes('tutor');
}

function isCounselorUser(u: any): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && roles.includes('counselor');
}

function isProviderUser(u: any): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && (roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor'));
}

function isNoShowProvider(session: any): boolean {
  const flag = String(session?.flag || '').trim().toLowerCase();
  const noShowParty = String(session?.noShowParty || '').trim().toLowerCase();
  const attendanceFlag = String(session?.attendanceFlag || '').trim().toLowerCase();
  const legacyStatus = String(session?.status || '').trim().toLowerCase();

  return (
    flag === 'provider_no_show' ||
    noShowParty === 'provider' ||
    noShowParty === 'both' ||
    attendanceFlag === 'provider_no_show' ||
    attendanceFlag === 'full_no_show' ||
    legacyStatus === 'provider_no_show' ||
    legacyStatus === 'no_show_provider' ||
    legacyStatus === 'expired_provider_no_show' ||
    legacyStatus === 'no_show_both'
  );
}

function isNoShowStudent(session: any): boolean {
  const flag = String(session?.flag || '').trim().toLowerCase();
  const noShowParty = String(session?.noShowParty || '').trim().toLowerCase();
  const legacyStatus = String(session?.status || '').trim().toLowerCase();

  return (
    flag === 'student_no_show' ||
    noShowParty === 'student' ||
    noShowParty === 'both' ||
    legacyStatus === 'student_no_show' ||
    legacyStatus === 'no_show_student' ||
    legacyStatus === 'no_show_both'
  );
}

function isFlaggedSession(session: any): boolean {
  // Admin tooling sets status=flagged + flaggedByAdminAt, and we also accept legacy flaggedAt/flaggedReason.
  const status = String(session?.status || '').trim().toLowerCase();
  const hasFlagFields = Boolean(session?.flaggedByAdminAt || session?.flaggedAt || session?.flaggedReason);
  return status === 'flagged' || status === 'requires_review' || hasFlagFields;
}

function isRefundedSession(session: any): boolean {
  const status = String(session?.status || '').trim().toLowerCase();
  const refundedCents = safeNumber(session?.amountRefundedCents);
  return status === 'refunded' || refundedCents > 0;
}

function monthKeysBackFromNow(count: number, nowMs: number): string[] {
  const out: string[] = [];
  const d = new Date(nowMs);
  // Start at current month (UTC) and go backwards
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(dt.toISOString().slice(0, 7));
  }
  return out.reverse();
}

export async function getAdminStatistics(args?: { months?: number }): Promise<AdminStatistics> {
  const nowMs = Date.now();
  const months = Math.max(3, Math.min(36, Math.floor(args?.months ?? 12)));

  const [users, sessions, reviews] = await Promise.all([getUsers(), getSessions(), getReviews()]);
  const allSessions = sessions as any[];

  // User totals
  const totalStudents = users.filter(isStudentUser).length;
  const totalProviders = users.filter(isProviderUser).length;
  const totalCounselors = users.filter(isCounselorUser).length;
  const totalTutors = users.filter(isTutorUser).length;

  // User growth (signups per month)
  const monthKeys = monthKeysBackFromNow(months, nowMs);
  const studentSignupsByMonth = new Map<string, number>();
  const providerSignupsByMonth = new Map<string, number>();

  for (const u of users as any[]) {
    const mk = monthKeyFromIso(typeof u?.createdAt === 'string' ? u.createdAt : null);
    if (!mk) continue;
    if (!studentSignupsByMonth.has(mk)) studentSignupsByMonth.set(mk, 0);
    if (!providerSignupsByMonth.has(mk)) providerSignupsByMonth.set(mk, 0);

    if (isStudentUser(u)) studentSignupsByMonth.set(mk, (studentSignupsByMonth.get(mk) || 0) + 1);
    if (isProviderUser(u)) providerSignupsByMonth.set(mk, (providerSignupsByMonth.get(mk) || 0) + 1);
  }

  const signupsPerMonth = monthKeys.map((m) => ({
    month: m,
    studentSignups: studentSignupsByMonth.get(m) || 0,
    providerSignups: providerSignupsByMonth.get(m) || 0,
  }));

  // Revenue + popularity + session health + earnings flow
  const serviceTypes: CanonicalServiceType[] = ['tutoring', 'test_prep', 'college_counseling', 'virtual_tour'];
  const revenueByService = new Map<CanonicalServiceType, number>(serviceTypes.map((s) => [s, 0]));
  const sessionsByService = new Map<CanonicalServiceType, number>(serviceTypes.map((s) => [s, 0]));

  const nowMonth = new Date(nowMs).toISOString().slice(0, 7);
  const lastMonth = new Date(Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);

  let totalRevenueCents = 0;
  let revenueThisMonthCents = 0;
  let revenueLastMonthCents = 0;

  let totalSessionsBooked = 0;
  let sessionsCompleted = 0;
  let sessionsNoShowProvider = 0;
  let sessionsNoShowStudent = 0;
  let refundedSessions = 0;
  let flaggedSessions = 0;

  let totalProviderEarningsCents = 0;
  let totalWithdrawnCents = 0;
  let pendingPayoutsCents = 0;

  const anyNoShowSessionIds = new Set<string>();

  for (const s of allSessions) {
    totalSessionsBooked += 1;

    const st = getServiceType(s);
    if (st) sessionsByService.set(st, (sessionsByService.get(st) || 0) + 1);

    if (String(s?.status || '') === 'completed') {
      sessionsCompleted += 1;
    }

    if (isNoShowProvider(s)) {
      sessionsNoShowProvider += 1;
      if (typeof s?.id === 'string') anyNoShowSessionIds.add(s.id);
    }
    if (isNoShowStudent(s)) {
      sessionsNoShowStudent += 1;
      if (typeof s?.id === 'string') anyNoShowSessionIds.add(s.id);
    }

    if (isRefundedSession(s)) refundedSessions += 1;
    if (isFlaggedSession(s)) flaggedSessions += 1;

    // Financials: use completed sessions as revenue source-of-truth (matches existing Admin Overview).
    if (String(s?.status || '') === 'completed') {
      const platformRevenue = getPlatformRevenueCents(s);
      totalRevenueCents += platformRevenue;

      if (st) revenueByService.set(st, (revenueByService.get(st) || 0) + platformRevenue);

      const completedIso =
        typeof s?.completedAt === 'string'
          ? s.completedAt
          : typeof s?.updatedAt === 'string'
            ? s.updatedAt
            : typeof s?.endTime === 'string'
              ? s.endTime
              : typeof s?.scheduledEndTime === 'string'
                ? s.scheduledEndTime
                : null;
      const mk = monthKeyFromIso(completedIso);
      if (mk === nowMonth) revenueThisMonthCents += platformRevenue;
      if (mk === lastMonth) revenueLastMonthCents += platformRevenue;

      // Earnings flow: provider payout is only earned when eligible (mirrors earnings summary).
      const eligible = Boolean(s?.providerEligibleForPayout === true);
      const providerPayoutCents = eligible ? calculateProviderPayoutCentsFromSession(s as any) : 0;
      totalProviderEarningsCents += providerPayoutCents;

      const payoutStatus = String(s?.payoutStatus || 'available');
      if (payoutStatus === 'paid' || payoutStatus === 'paid_out') {
        totalWithdrawnCents += providerPayoutCents;
      } else if (payoutStatus === 'pending_payout' || payoutStatus === 'approved' || payoutStatus === 'locked') {
        pendingPayoutsCents += providerPayoutCents;
      }
    }
  }

  const byService = serviceTypes.map((serviceType) => {
    const revenueCents = revenueByService.get(serviceType) || 0;
    const percentOfTotal = totalRevenueCents > 0 ? revenueCents / totalRevenueCents : 0;
    return { serviceType, revenueCents, percentOfTotal: clamp01(percentOfTotal) };
  });

  const sessionsByServiceArr = serviceTypes.map((serviceType) => ({
    serviceType,
    sessionCount: sessionsByService.get(serviceType) || 0,
  }));

  // Quality & reviews
  const ratings = (reviews as any[])
    .map((r) => safeNumber(r?.rating))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  const numberOfReviews = ratings.length;
  const averageProviderRating =
    numberOfReviews > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / numberOfReviews).toFixed(2)) : null;

  const reviewedSessionIds = new Set<string>();
  for (const r of reviews as any[]) {
    const sid = typeof r?.sessionId === 'string' ? r.sessionId.trim() : '';
    if (sid) reviewedSessionIds.add(sid);
  }
  const completedSessionIds = new Set<string>();
  for (const s of allSessions) {
    if (String(s?.status || '') === 'completed' && typeof s?.id === 'string') completedSessionIds.add(s.id);
  }
  const reviewedCompletedCount = Array.from(reviewedSessionIds).filter((sid) => completedSessionIds.has(sid)).length;
  const percentOfSessionsReviewed =
    completedSessionIds.size > 0 ? clamp01(reviewedCompletedCount / completedSessionIds.size) : 0;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    revenueOverview: {
      totalRevenueCents,
      revenueThisMonthCents,
      revenueLastMonthCents,
      byService,
    },
    servicePopularity: {
      sessionsByService: sessionsByServiceArr,
    },
    userGrowth: {
      totals: {
        totalStudents,
        totalProviders,
        totalCounselors,
        totalTutors,
      },
      signupsPerMonth,
    },
    sessionHealth: {
      totalSessionsBooked,
      sessionsCompleted,
      sessionsNoShowProvider,
      sessionsNoShowStudent,
      refundedSessions,
      flaggedSessions,
      completionRate: totalSessionsBooked > 0 ? clamp01(sessionsCompleted / totalSessionsBooked) : 0,
      noShowRate: totalSessionsBooked > 0 ? clamp01(anyNoShowSessionIds.size / totalSessionsBooked) : 0,
    },
    earningsFlow: {
      totalProviderEarningsCents,
      totalWithdrawnCents,
      pendingPayoutsCents,
    },
    qualityReviews: {
      averageProviderRating,
      numberOfReviews,
      percentOfSessionsReviewed,
    },
  };
}


