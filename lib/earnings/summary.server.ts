/**
 * Earnings Summary
 * 
 * Shared functions for calculating provider earnings from sessions (source of truth).
 * Earnings totals are NOT persisted; they are derived dynamically from completed sessions.
 */

import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { getProviderPayoutRequestTotals } from '@/lib/payouts/payout-requests.server';

const PROVIDER_EARNING_COMPLETED_STATUSES = new Set<string>([
  'completed',
  'completed_provider_show',
  'completed_no_show_student',
]);

/**
 * Canonical provider earnings + payout-request summary (single source of truth).
 *
 * Source of truth requirements:
 * - totalEarnings = SUM(provider payout) from sessions WHERE status IN completed variants (excluding provider no-show)
 * - totalWithdrawn = SUM(payoutRequests.amount) WHERE status === "completed"
 * - pendingPayouts = SUM(payoutRequests.amount) WHERE status IN ("pending", "pending_admin_review", "processing")
 * - availableBalance = totalEarnings - totalWithdrawn - pendingPayouts
 */
export async function getProviderEarningsSummary(providerId: string): Promise<{
  totalEarningsCents: number;
  totalWithdrawnCents: number;
  pendingPayoutsCents: number;
  availableBalanceCents: number;
  completedSessionCount: number;
  completedSessions?: any[];
}> {
  const sessions = await getSessionsByProviderId(providerId);
  // IMPORTANT: do NOT include 'completed_no_show_provider' because provider does not earn in that case.
  const completedSessions = sessions.filter((s: any) => PROVIDER_EARNING_COMPLETED_STATUSES.has(String(s?.status || '')));

  const totalEarningsCents = completedSessions.reduce((sum, s) => {
    // Only exclude earnings when explicitly marked as ineligible/withheld.
    // (Many sessions omit these flags entirely, so we must NOT require them to be true.)
    const providerEarned = (s as any)?.providerEarned;
    const eligible = (s as any)?.providerEligibleForPayout;
    if (providerEarned === false || eligible === false) return sum;

    // Prefer stored earnings fields when present (source of truth for summary API).
    const anyS = s as any;
    const fromProviderEarnings = typeof anyS?.providerEarnings === 'number' ? anyS.providerEarnings : null;
    const fromAmountEarned = typeof anyS?.amountEarned === 'number' ? anyS.amountEarned : null;
    const fromProviderPayoutCents = typeof anyS?.provider_payout_cents === 'number' ? anyS.provider_payout_cents : null;
    const fromProviderPayoutDollars = typeof anyS?.providerPayout === 'number' ? Math.round(anyS.providerPayout * 100) : null;

    const cents =
      fromProviderEarnings ??
      fromAmountEarned ??
      fromProviderPayoutCents ??
      fromProviderPayoutDollars ??
      0;

    return sum + (Number.isFinite(cents) ? cents : 0);
  }, 0);

  const totals = await getProviderPayoutRequestTotals(providerId);
  const pendingPayoutsCents = totals.pendingCents;
  const totalWithdrawnCents = totals.withdrawnCents;

  const totalEarnedCents = Math.max(0, Math.floor(totalEarningsCents));
  const withdrawnCents = Math.max(0, Math.floor(totalWithdrawnCents));
  const pendingCents = Math.max(0, Math.floor(pendingPayoutsCents));
  const availableBalanceCents = Math.max(0, totalEarnedCents - withdrawnCents - pendingCents);

  return {
    totalEarningsCents: totalEarnedCents,
    totalWithdrawnCents: withdrawnCents,
    pendingPayoutsCents: pendingCents,
    availableBalanceCents,
    completedSessionCount: completedSessions.length,
    // Debug helper for API routes. (Avoid depending on this in client/UI code.)
    completedSessions,
  };
}

/**
 * Backward-compatible wrapper for older UI call sites that expect dollar amounts.
 * Prefer `getProviderEarningsSummary()` for new code.
 */
export async function getProviderEarnings(providerId: string): Promise<{
  totalEarned: number; // dollars
  pending: number; // dollars (pending payouts)
}> {
  const summary = await getProviderEarningsSummary(providerId);
  return {
    totalEarned: summary.totalEarningsCents / 100,
    pending: summary.pendingPayoutsCents / 100,
  };
}

