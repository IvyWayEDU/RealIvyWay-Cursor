/**
 * Earnings Summary
 * 
 * Shared functions for calculating provider earnings from sessions (source of truth).
 * Earnings totals are NOT persisted; they are derived dynamically from completed sessions.
 */

import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { getProviderPayoutRequestTotals } from '@/lib/payouts/payout-requests.server';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import { computeProviderEarningsTotals } from '@/lib/earnings/providerEarningsSummary';

/**
 * Canonical provider earnings + payout-request summary (single source of truth).
 *
 * Source of truth requirements:
 * - totalEarnings = SUM(provider payout) from the SAME completed-session rows shown in Earnings Breakdown
 * - pending = SUM(payoutRequests.amount) WHERE status === "pending"
 * - approved = SUM(payoutRequests.amount) WHERE status === "approved"
 * - paid = SUM(payoutRequests.amount) WHERE status === "paid"
 * - availableBalance = totalEarnings - pending - approved - paid
 */
export async function getProviderEarningsSummary(providerId: string): Promise<{
  totalEarningsCents: number;
  totalWithdrawnCents: number;
  pendingPayoutsCents: number;
  approvedPayoutsCents: number;
  paidPayoutsCents: number;
  availableBalanceCents: number;
  completedSessionCount: number;
  completedSessions?: any[];
}> {
  const sessions = await getSessionsByProviderId(providerId);
  // IMPORTANT:
  // The Earnings Breakdown table currently shows sessions where `status === "completed"`.
  // To keep totals consistent across the app, this summary MUST use the exact same row set.
  const completedSessions = sessions.filter((s: any) => String(s?.status || '') === 'completed');

  const totals = await getProviderPayoutRequestTotals(providerId);

  // IMPORTANT:
  // Totals must be derived from the SAME per-session payout calculation used by the breakdown table.
  // Also, per requirements, do NOT gate earnings totals on flags like:
  // - providerEarned
  // - providerEligibleForPayout
  // The breakdown table includes those rows, so totals must too.
  const earningsRowAmountsCents = completedSessions.map((s: any) => calculateProviderPayoutCentsFromSession(s));
  const positiveEarningsRows = earningsRowAmountsCents.filter((c) => Number(c || 0) > 0).length;

  const computed = computeProviderEarningsTotals({
    earningsRowAmountsCents,
    payoutTotals: {
      pendingCents: totals.pendingCents,
      approvedCents: totals.approvedCents,
      paidCents: totals.paidCents,
    },
  });

  const approvedPayoutsCents = Math.max(0, Math.floor(Number(totals.approvedCents || 0)));
  const paidPayoutsCents = Math.max(0, Math.floor(Number(totals.paidCents || 0)));

  // Temporary debug logs (remove after verification).
  console.log('[EARNINGS_SUMMARY_DEBUG]', {
    providerId,
    earningsRows: earningsRowAmountsCents.length,
    positiveEarningsRows,
    totalEarningsCents: computed.totalEarningsCents,
    pendingPayoutsCents: computed.pendingPayoutsCents,
    totalWithdrawnCents: computed.totalWithdrawnCents,
    availableBalanceCents: computed.availableBalanceCents,
  });

  return {
    totalEarningsCents: computed.totalEarningsCents,
    totalWithdrawnCents: computed.totalWithdrawnCents,
    // Per spec: pendingPayouts includes both pending + approved payout requests.
    pendingPayoutsCents: computed.pendingPayoutsCents,
    approvedPayoutsCents,
    paidPayoutsCents,
    availableBalanceCents: computed.availableBalanceCents,
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

