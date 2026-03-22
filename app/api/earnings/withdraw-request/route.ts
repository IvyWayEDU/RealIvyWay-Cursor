import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { validateRequestBody } from '@/lib/validation/utils';
import { withdrawalRequestSchema } from '@/lib/validation/schemas';
import { getProviderByUserId } from '@/lib/providers/storage';
import { createPayoutRequest } from '@/lib/payouts/payout-requests.server';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import { getProviderPayoutRequestTotals } from '@/lib/payouts/payout-requests.server';
import Stripe from 'stripe';
import type { ProviderProfile, Session } from '@/lib/models/types';
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
    // Validate provider session
    const authResult = await auth.requireProvider();
    if (authResult.error) {
      return Response.json(
        {
          success: false,
          error:
            authResult.error.status === 401
              ? 'Unauthorized'
              : 'Forbidden: Only providers can request withdrawals',
        },
        { status: authResult.error.status }
      );
    }

    const session = authResult.session!;

    const rl = enforceRateLimit(request, {
      session: session as any,
      endpoint: '/api/earnings/withdraw-request',
      body: { success: false, error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const validationResult = await validateRequestBody(request, withdrawalRequestSchema);
    if (!validationResult.success) return validationResult.response;
    const { amountCents } = validationResult.data;

    const providerId = session.userId;

    const provider: ProviderProfile | null = await getProviderByUserId(providerId);
    const stripeConnectAccountId =
      typeof provider?.stripeConnectAccountId === 'string' ? provider.stripeConnectAccountId.trim() : '';
    if (!stripeConnectAccountId) {
      return Response.json(
        { success: false, error: 'Stripe Connect account is not linked. Please link a Stripe Connect account first.' },
        { status: 400 }
      );
    }

    // WITHDRAWAL VALIDATION: provider must be verified and active
    if ((provider as any)?.active === false) {
      return Response.json({ success: false, error: 'Provider account is inactive' }, { status: 403 });
    }
    if ((provider as any)?.verified !== true) {
      return Response.json(
        { success: false, error: 'Provider account must be verified before requesting withdrawals' },
        { status: 400 }
      );
    }

    // Enforce real Stripe status (no "fake connected" states)
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return Response.json({ success: false, error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    });
    const account = await stripe.accounts.retrieve(stripeConnectAccountId);
    if (!account.details_submitted) {
      return Response.json(
        { success: false, error: 'Stripe setup is incomplete. Please complete Stripe onboarding first.' },
        { status: 400 }
      );
    }
    if (!account.payouts_enabled) {
      return Response.json(
        { success: false, error: 'Stripe payouts are not enabled yet. Please resolve any Stripe requirements first.' },
        { status: 400 }
      );
    }

    // Always calculate the available balance fresh from the database (no Stripe balance API, no stored field).
    const sessions = (await getSessionsByProviderId(providerId)) as unknown as Session[];
    const completedLike = new Set<string>(['completed', 'completed_provider_show', 'completed_no_show_student']);
    const totalEarningsCents = sessions
      .filter((s) => completedLike.has(String(s?.status || '')) && String(s?.providerId || '') === providerId)
      .reduce((sum: number, s) => sum + calculateProviderPayoutCentsFromSession(s), 0);
    const totals = await getProviderPayoutRequestTotals(providerId);
    const totalWithdrawnCents = totals.withdrawnCents;
    const pendingPayoutsCents = totals.pendingCents;
    const availableBalanceCents = Math.max(0, totalEarningsCents - totalWithdrawnCents - pendingPayoutsCents);
    if (amountCents > availableBalanceCents) {
      return Response.json(
        {
          success: false,
          error: `Invalid amount. Amount cannot exceed available balance of $${(availableBalanceCents / 100).toFixed(
            2
          )}.`,
          availableBalanceCents,
        },
        { status: 400 }
      );
    }

    const payoutRequest = await createPayoutRequest({
      providerId,
      amountCents,
      payoutMethod: 'Stripe',
      payoutDestinationMasked: maskStripeAccountDestination(stripeConnectAccountId),
      // legacy
      payoutDestination: maskStripeAccountDestination(stripeConnectAccountId),
    });

    return Response.json({ success: true, payoutRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/earnings/withdraw-request]' });
  }
}



