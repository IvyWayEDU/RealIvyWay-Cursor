import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';

export async function getProviderPayoutSummaryFromLedger(providerId: string): Promise<{
  availableBalanceCents: number;
  pendingWithdrawalsCents: number;
  totalWithdrawnCents: number;
  ledgerBalanceCents: number;
  totalEarningsCents: number;
  pendingPayoutsCents: number;
}> {
  const summary = await getProviderEarningsSummary(providerId);
  return {
    availableBalanceCents: summary.availableBalanceCents,
    pendingWithdrawalsCents: summary.pendingPayoutsCents, // backward-compatible name
    totalWithdrawnCents: summary.totalWithdrawnCents,
    // "ledgerBalanceCents" is a legacy concept; we keep the field for compatibility.
    ledgerBalanceCents: summary.totalEarningsCents,
    totalEarningsCents: summary.totalEarningsCents,
    pendingPayoutsCents: summary.pendingPayoutsCents,
  };
}


