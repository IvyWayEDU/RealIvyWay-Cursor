import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';
import { handleApiError } from '@/lib/errorHandler';

export async function GET(_request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;
    const user = session.user;

    const summary = await getProviderEarningsSummary(user.id);

    return NextResponse.json({
      totalEarnings: summary.totalEarningsCents / 100,
      totalWithdrawn: summary.totalWithdrawnCents / 100,
      pendingPayouts: summary.pendingPayoutsCents / 100,
      availableBalance: summary.availableBalanceCents / 100,
      totalEarningsCents: summary.totalEarningsCents,
      totalWithdrawnCents: summary.totalWithdrawnCents,
      pendingPayoutsCents: summary.pendingPayoutsCents,
      availableBalanceCents: summary.availableBalanceCents,
      approvedPayoutsCents: summary.approvedPayoutsCents,
      paidPayoutsCents: summary.paidPayoutsCents,
      // Temporary debug field for verification (remove after validation).
      earningsRows: summary.completedSessionCount,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/provider/earnings/summary]' });
  }
}


