export type ProviderPayoutRequestTotals = {
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
};

export type ProviderEarningsTotals = {
  totalEarningsCents: number;
  pendingPayoutsCents: number;
  totalWithdrawnCents: number;
  availableBalanceCents: number;
};

function toNonNegativeInt(v: unknown): number {
  const n = Math.floor(Number(v || 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Computes provider earnings totals from the exact earnings rows used for breakdown.
 *
 * Definitions (per product spec):
 * - totalEarnings = sum of all earnings rows
 * - pendingPayouts = sum of payout requests with status pending or approved
 * - totalWithdrawn = sum of payout requests with status paid
 * - availableBalance = totalEarnings - pendingPayouts - totalWithdrawn
 */
export function computeProviderEarningsTotals(args: {
  earningsRowAmountsCents: Array<number | null | undefined>;
  payoutTotals: ProviderPayoutRequestTotals;
}): ProviderEarningsTotals {
  const totalEarningsCents = args.earningsRowAmountsCents.reduce<number>(
    (sum, v) => sum + toNonNegativeInt(v),
    0
  );

  const pendingCents = toNonNegativeInt(args.payoutTotals.pendingCents);
  const approvedCents = toNonNegativeInt(args.payoutTotals.approvedCents);
  const paidCents = toNonNegativeInt(args.payoutTotals.paidCents);

  const pendingPayoutsCents = pendingCents + approvedCents;
  const totalWithdrawnCents = paidCents;
  const availableBalanceCents = Math.max(0, totalEarningsCents - pendingPayoutsCents - totalWithdrawnCents);

  return {
    totalEarningsCents,
    pendingPayoutsCents,
    totalWithdrawnCents,
    availableBalanceCents,
  };
}

