import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import Stripe from 'stripe';
import crypto from 'crypto';
import { getPayoutRequestById, updatePayoutRequest } from '@/lib/payouts/payout-requests.server';
import { getProviderByUserId } from '@/lib/providers/storage';
import { debitProviderEarningsBalanceCents } from '@/lib/earnings/balances.server';

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
    if (pr.status !== 'pending' && pr.status !== 'pending_admin_review') {
      return NextResponse.json({ error: `Cannot approve payout request in status "${pr.status}"` }, { status: 400 });
    }

    const provider = await getProviderByUserId(pr.providerId);
    const stripeConnectAccountId = String((provider as any)?.stripeConnectAccountId || '').trim();
    if (!stripeConnectAccountId) {
      return NextResponse.json({ error: 'Provider has no Stripe Connect account linked' }, { status: 400 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const idempotencyKey = crypto.createHash('sha256').update(`payoutreq:${pr.id}`).digest('hex').slice(0, 32);

    // Mark as processing first so provider "pending payouts" is accurate even if Stripe call fails mid-flight.
    const processing = await updatePayoutRequest(pr.id, { status: 'processing' });
    if (!processing) return NextResponse.json({ error: 'Failed to update payout request' }, { status: 500 });

    const transfer = await stripe.transfers.create(
      {
        amount: pr.amountCents,
        currency: 'usd',
        destination: stripeConnectAccountId,
        metadata: {
          providerId: pr.providerId,
          payoutRequestId: pr.id,
          type: 'provider_payout_request',
        },
      },
      { idempotencyKey }
    );

    const updated = await updatePayoutRequest(pr.id, {
      status: 'completed',
      stripeTransferId: transfer.id,
    });
    if (!updated) return NextResponse.json({ error: 'Failed to update payout request' }, { status: 500 });

    await debitProviderEarningsBalanceCents(pr.providerId, pr.amountCents);

    return NextResponse.json({ success: true, payoutRequest: updated, transferId: transfer.id }, { status: 200 });
  } catch (error) {
    console.error('[admin/payout-requests/approve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


