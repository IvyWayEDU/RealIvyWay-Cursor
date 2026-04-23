import 'server-only';

import { getUsers } from '@/lib/auth/storage';
import { getSessions } from '@/lib/sessions/storage';
import { isSessionCompleted, isSessionUpcoming } from '@/lib/sessions/lifecycle';
import { getAllSupportTickets } from '@/lib/support/ticketingStorage';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';

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
  openSupportTickets: number;
  pendingSupportTickets: number;
  unreadSupportTickets: number;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [users, sessions, supportTickets] = await Promise.all([getUsers(), getSessions(), getAllSupportTickets()]);

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

    // Canonical financials MUST be derived from current business rules (never stale stored fields).
    const providerPayoutCents = calculateProviderPayoutCentsFromSession(s as any);
    const ivywayTakeCents = safeNumber(s?.ivyway_take_cents);
    const platformFeeFallbackCents = safeNumber(s?.platformFeeCents);
    const grossCents = getSessionGrossCents(s as any);
    const platformRevenueCents = ivywayTakeCents || platformFeeFallbackCents || Math.max(0, Math.floor(grossCents - providerPayoutCents));

    totalPlatformRevenueCents += platformRevenueCents;
    totalProviderPayoutsCents += providerPayoutCents;
  }

  const openSupportTickets = supportTickets.filter((t: any) => t?.status === 'open' || t?.status === 'admin_replied').length;
  const pendingSupportTickets = supportTickets.filter((t: any) => t?.status === 'pending').length;
  const unreadSupportTickets = supportTickets.filter((t: any) => {
    const status = String(t?.status ?? '');
    if (!['open', 'pending', 'admin_replied'].includes(status)) return false;
    const unread = typeof t?.unreadForAdmin === 'number' ? t.unreadForAdmin : Number(t?.unreadForAdmin ?? 0);
    return Number.isFinite(unread) && unread > 0;
  }).length;

  return {
    totalUsers,
    totalStudents,
    totalProviders,
    totalSessions,
    upcomingSessions,
    completedSessions,
    totalPlatformRevenueCents,
    totalProviderPayoutsCents,
    openSupportTickets,
    pendingSupportTickets,
    unreadSupportTickets,
  };
}


