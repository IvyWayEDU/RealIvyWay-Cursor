import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { validateRequestBody } from '@/lib/validation/utils';
import { withdrawalRequestSchema } from '@/lib/validation/schemas';
import { getProviderByUserId } from '@/lib/providers/storage';
import { createPayoutRequest } from '@/lib/payouts/payout-requests.server';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import { getProviderPayoutRequestTotals } from '@/lib/payouts/payout-requests.server';
import Stripe from 'stripe';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function maskStripeAccountDestination(acct: string): string {
  const a = String(acct || '').trim();
  if (!a) return 'Stripe Connect';
  const last4 = a.length >= 4 ? a.slice(-4) : a;
  return `Stripe Connect •••• ${last4}`;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/stripe/payout/request',
      body: { success: false, error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const validationResult = await validateRequestBody(request, withdrawalRequestSchema);
    if (!validationResult.success) return validationResult.response;
    // Normalize to integer cents server-side (do not trust clients).
    const requestedAmountCents = Math.max(0, Math.floor(Number(validationResult.data.amountCents || 0)));

    const provider = await getProviderByUserId(session.userId);
    if (!provider) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });

    const stripeConnectAccountId = String((provider as any)?.stripeConnectAccountId || '').trim();
    if (!stripeConnectAccountId) {
      return NextResponse.json(
        { success: false, error: 'Stripe Connect account is not linked. Please connect Stripe first.' },
        { status: 400 }
      );
    }

    // Enforce real Stripe status (no "fake connected" states)
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ success: false, error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    });
    const account = await stripe.accounts.retrieve(stripeConnectAccountId);
    if (!account.details_submitted) {
      return NextResponse.json(
        { success: false, error: 'Stripe setup is incomplete. Please complete Stripe onboarding first.' },
        { status: 400 }
      );
    }
    if (!account.payouts_enabled) {
      return NextResponse.json(
        { success: false, error: 'Stripe payouts are not enabled yet. Please resolve any Stripe requirements first.' },
        { status: 400 }
      );
    }

    // IMPORTANT: Always calculate the available balance fresh from the database.
    // Do NOT rely on any stored "availableBalance" fields and do NOT call Stripe balance APIs.
    const sessions = await getSessionsByProviderId(session.userId);
    const completedLike = new Set<string>(['completed', 'completed_provider_show', 'completed_no_show_student']);
    const totalEarningsCents = sessions
      .filter((s: any) => completedLike.has(String(s?.status || '')) && s?.providerId === session.userId)
      .reduce((sum: number, s: any) => sum + calculateProviderPayoutCentsFromSession(s), 0);
    const totals = await getProviderPayoutRequestTotals(session.userId);
    const totalWithdrawnCents = totals.withdrawnCents;
    const pendingPayoutsCents = totals.pendingCents;
    const availableBalanceCents = Math.max(0, totalEarningsCents - totalWithdrawnCents - pendingPayoutsCents);

    if (requestedAmountCents > availableBalanceCents) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid amount. Amount cannot exceed available balance of $${(availableBalanceCents / 100).toFixed(2)}.`,
          availableBalanceCents,
        },
        { status: 400 }
      );
    }

    const payoutRequest = await createPayoutRequest({
      providerId: session.userId,
      amountCents: requestedAmountCents,
      payoutMethod: 'Stripe',
      payoutDestinationMasked: maskStripeAccountDestination(stripeConnectAccountId),
      // legacy
      payoutDestination: maskStripeAccountDestination(stripeConnectAccountId),
    });

    return NextResponse.json({ success: true, payoutRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/stripe/payout/request]' });
  }
}


