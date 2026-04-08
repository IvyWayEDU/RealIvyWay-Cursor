import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';
import { getProviderEarningsBalance } from '@/lib/earnings/balances.server';

export async function getProviderPayoutSummaryFromLedger(providerId: string): Promise<{
  availableBalanceCents: number;
  pendingWithdrawalsCents: number;
  totalWithdrawnCents: number;
  ledgerBalanceCents: number;
  totalEarningsCents: number;
  pendingPayoutsCents: number;
  approvedPayoutsCents: number;
  paidPayoutsCents: number;
}> {
  const [summary, balance] = await Promise.all([
    getProviderEarningsSummary(providerId),
    getProviderEarningsBalance(providerId),
  ]);
  return {
    availableBalanceCents: balance.availableCents,
    pendingWithdrawalsCents: balance.pendingCents, // backward-compatible name
    totalWithdrawnCents: balance.withdrawnCents,
    // "ledgerBalanceCents" is a legacy concept; we keep the field for compatibility.
    ledgerBalanceCents: summary.totalEarningsCents,
    totalEarningsCents: summary.totalEarningsCents,
    pendingPayoutsCents: balance.pendingCents,
    approvedPayoutsCents: summary.approvedPayoutsCents,
    paidPayoutsCents: summary.paidPayoutsCents,
  };
}


