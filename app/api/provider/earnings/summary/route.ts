import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';
import { getProviderEarningsBalance } from '@/lib/earnings/balances.server';
import { handleApiError } from '@/lib/errorHandler';

export async function GET(_request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;
    const user = session.user;

    const summary = await getProviderEarningsSummary(user.id);
    const balance = await getProviderEarningsBalance(user.id);

    return NextResponse.json({
      totalEarnings: summary.totalEarningsCents / 100,
      totalWithdrawn: balance.withdrawnCents / 100,
      pendingPayouts: balance.pendingCents / 100,
      availableBalance: balance.availableCents / 100,
      totalEarningsCents: summary.totalEarningsCents,
      totalWithdrawnCents: balance.withdrawnCents,
      pendingPayoutsCents: balance.pendingCents,
      availableBalanceCents: balance.availableCents,
      approvedPayoutsCents: summary.approvedPayoutsCents,
      paidPayoutsCents: summary.paidPayoutsCents,
      // Raw DB-shape mirror for UI verification/debugging.
      balance: {
        available_cents: balance.availableCents,
        pending_cents: balance.pendingCents,
        withdrawn_cents: balance.withdrawnCents,
      },
      // Temporary debug field for verification (remove after validation).
      earningsRows: summary.completedSessionCount,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/provider/earnings/summary]' });
  }
}


