import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth/middleware';
import { getProviderByUserId } from '@/lib/providers/storage';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

export type StripeConnectStatus = 'not_created' | 'incomplete' | 'restricted' | 'connected';

export async function GET(_request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const provider = await getProviderByUserId(session.userId);
    if (!provider) return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 });

    const stripeConnectAccountId = String((provider as any)?.stripeConnectAccountId || '').trim();
    if (!stripeConnectAccountId) {
      return NextResponse.json({ status: 'not_created' satisfies StripeConnectStatus }, { status: 200 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    });
    const account = await stripe.accounts.retrieve(stripeConnectAccountId);

    if (!account.details_submitted) {
      return NextResponse.json({ status: 'incomplete' satisfies StripeConnectStatus }, { status: 200 });
    }

    if (!account.payouts_enabled) {
      return NextResponse.json({ status: 'restricted' satisfies StripeConnectStatus }, { status: 200 });
    }

    return NextResponse.json({ status: 'connected' satisfies StripeConnectStatus }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/stripe/connect/status]' });
  }
}


