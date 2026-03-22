import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getPayoutRequestById, updatePayoutRequestIfStatus } from '@/lib/payouts/payout-requests.server';
import { handleApiError } from '@/lib/errorHandler';

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
    // Accept both canonical "pending" and legacy "pending_admin_review".
    if (pr.status === 'approved') {
      // Idempotent: already approved.
      return NextResponse.json({ success: true, payoutRequest: pr }, { status: 200 });
    }
    if (pr.status !== 'pending' && pr.status !== 'pending_admin_review') {
      return NextResponse.json({ error: `Cannot approve payout request in status "${pr.status}"` }, { status: 400 });
    }

    // Manual payout flow:
    // - Admin approval only marks the request as approved (no Stripe transfers, no balance mutations).
    const nowISO = new Date().toISOString();
    const cas = await updatePayoutRequestIfStatus({
      id: pr.id,
      fromStatuses: ['pending', 'pending_admin_review'],
      patch: {
        status: 'approved',
        approvedAt: nowISO,
        updatedAt: nowISO,
      },
    });
    if (!cas.payoutRequest) return NextResponse.json({ error: 'Failed to update payout request' }, { status: 500 });
    if (!cas.updated && cas.payoutRequest.status !== 'approved') {
      return NextResponse.json({ error: `Cannot approve payout request in status "${cas.payoutRequest.status}"` }, { status: 400 });
    }
    return NextResponse.json({ success: true, payoutRequest: cas.payoutRequest }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/payout-requests/approve]' });
  }
}


