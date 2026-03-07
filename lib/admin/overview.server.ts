import 'server-only';

import { getUsers } from '@/lib/auth/storage';
import { getSessions } from '@/lib/sessions/storage';
import { isSessionCompleted, isSessionUpcoming } from '@/lib/sessions/lifecycle';

function safeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function providerCountFromUser(u: any): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && (roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor'));
}

function studentCountFromUser(u: any): boolean {
  const roles = u?.roles;
  return Array.isArray(roles) && roles.includes('student');
}

export type AdminOverviewStats = {
  totalUsers: number;
  totalStudents: number;
  totalProviders: number;
  totalSessions: number;
  upcomingSessions: number;
  completedSessions: number;
  totalPlatformRevenueCents: number;
  totalProviderPayoutsCents: number;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [users, sessions] = await Promise.all([getUsers(), getSessions()]);

  const totalUsers = users.length;
  const totalStudents = users.filter(studentCountFromUser).length;
  const totalProviders = users.filter(providerCountFromUser).length;

  const totalSessions = sessions.length;
  const nowMs = Date.now();

  const upcomingSessions = sessions.filter((s) => isSessionUpcoming(s as any, nowMs) && !isSessionCompleted(s as any, nowMs)).length;
  const completedSessions = sessions.filter((s) => isSessionCompleted(s as any, nowMs) || (s as any)?.status === 'completed').length;

  let totalPlatformRevenueCents = 0;
  let totalProviderPayoutsCents = 0;

  for (const s of sessions as any[]) {
    if ((s?.status ?? '') !== 'completed') continue;

    // Preferred canonical fields in this repo's session JSON.
    const ivywayTake = safeNumber(s?.ivyway_take_cents);
    const providerPayout = safeNumber(s?.provider_payout_cents);

    // Fallbacks used across older records.
    const platformFeeFallback = safeNumber(s?.platformFeeCents);
    const providerPayoutFallback = safeNumber(s?.providerPayoutCents);
    const providerPayoutDollar = safeNumber(s?.providerPayout) * 100;

    totalPlatformRevenueCents += ivywayTake || platformFeeFallback;
    totalProviderPayoutsCents += providerPayout || providerPayoutFallback || providerPayoutDollar;
  }

  return {
    totalUsers,
    totalStudents,
    totalProviders,
    totalSessions,
    upcomingSessions,
    completedSessions,
    totalPlatformRevenueCents,
    totalProviderPayoutsCents,
  };
}


