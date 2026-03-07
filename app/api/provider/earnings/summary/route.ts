import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { listProviderPayoutRequests } from '@/lib/payouts/payout-requests.server';

export async function GET(_request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;
    const user = session.user;

    // Always compute fresh from underlying storage (no stored summary fields).
    const sessions = await getSessionsByProviderId(user.id);

    // totalEarningsCents = sum of provider earned sessions (completed + positive payout)
    const totalEarningsCents = Math.max(
      0,
      Math.floor(
        sessions
          .filter((s: any) => String(s?.status || '') === 'completed')
          .reduce((sum: number, s: any) => {
            const cents =
              typeof s?.provider_payout_cents === 'number'
                ? s.provider_payout_cents
                : Number(s?.provider_payout_cents);
            return sum + (Number.isFinite(cents) ? cents : 0);
          }, 0)
      )
    );

    // payout "table" = payout requests for this provider
    // Requirements:
    // - pendingPayoutsCents = SUM(amountCents) WHERE status === "pending"
    // - totalWithdrawnCents = SUM(amountCents) WHERE status IN ("approved","paid")
    // Note: we also treat legacy/canonical "completed" as withdrawn for compatibility.
    const payouts = await listProviderPayoutRequests(user.id);
    const pendingPayoutsCents = Math.max(
      0,
      Math.floor(
        payouts
          .filter((p) => String((p as any)?.status || '') === 'pending')
          .reduce((sum, p) => sum + Number((p as any)?.amountCents || 0), 0)
      )
    );
    const totalWithdrawnCents = Math.max(
      0,
      Math.floor(
        payouts
          .filter((p) => {
            const status = String((p as any)?.status || '');
            return status === 'approved' || status === 'paid' || status === 'completed';
          })
          .reduce((sum, p) => sum + Number((p as any)?.amountCents || 0), 0)
      )
    );

    const availableBalanceCents = Math.max(
      0,
      totalEarningsCents - totalWithdrawnCents - pendingPayoutsCents
    );

    return NextResponse.json({
      totalEarnings: totalEarningsCents / 100,
      totalWithdrawn: totalWithdrawnCents / 100,
      pendingPayouts: pendingPayoutsCents / 100,
      availableBalance: availableBalanceCents / 100,
      totalEarningsCents,
      totalWithdrawnCents,
      pendingPayoutsCents,
      availableBalanceCents,
    });
  } catch (error) {
    console.error('[api/provider/earnings/summary] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


