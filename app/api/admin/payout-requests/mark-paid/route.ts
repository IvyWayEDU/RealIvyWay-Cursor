import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getPayoutRequestById, updatePayoutRequestIfStatus } from '@/lib/payouts/payout-requests.server';
import { handleApiError } from '@/lib/errorHandler';
import { sendPayoutPaidEmail } from '@/lib/email/transactional';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const payoutRequestId = String((body as any)?.payoutRequestId ?? '').trim();
    if (!payoutRequestId) return NextResponse.json({ error: 'payoutRequestId is required' }, { status: 400 });

    const pr = await getPayoutRequestById(payoutRequestId);
    if (!pr) return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });

    // Allow marking paid only after approval. (Legacy "processing" is treated as approved.)
    if (pr.status === 'paid' || pr.status === 'completed') {
      // Idempotent: already paid.
      return NextResponse.json({ success: true, payoutRequest: pr }, { status: 200 });
    }
    if (pr.status !== 'approved' && pr.status !== 'processing') {
      return NextResponse.json({ error: `Cannot mark payout request as paid in status "${pr.status}"` }, { status: 400 });
    }

    const nowISO = new Date().toISOString();
    const cas = await updatePayoutRequestIfStatus({
      id: pr.id,
      fromStatuses: ['approved', 'processing'],
      patch: { status: 'paid', paidAt: nowISO, updatedAt: nowISO },
    });
    if (!cas.payoutRequest) return NextResponse.json({ error: 'Failed to update payout request' }, { status: 500 });
    const updated = cas.payoutRequest;

    // Transactional email: payout confirmation (send only on successful transition)
    if (cas.updated) {
      try {
        await sendPayoutPaidEmail({
          providerId: updated.providerId,
          amountCents: updated.amountCents,
          payoutMethod: updated.payoutMethod,
          payoutDestinationMasked: updated.payoutDestinationMasked || updated.payoutDestination,
          paidAt: updated.paidAt,
        });
      } catch (e) {
        console.warn('[email] payout paid email failed (non-blocking)', {
          payoutRequestId: updated.id,
          providerId: updated.providerId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ success: true, payoutRequest: updated }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/payout-requests/mark-paid]' });
  }
}

