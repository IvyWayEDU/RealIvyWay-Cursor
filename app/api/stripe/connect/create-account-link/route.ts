import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import Stripe from 'stripe';
import { getProviderByUserId, updateProvider } from '@/lib/providers/storage';
import { getUserById } from '@/lib/auth/storage';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' }, { status: 500 });
    }

    const provider = await getProviderByUserId(session.userId);
    if (!provider) return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 });

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    let stripeConnectAccountId = String((provider as any)?.stripeConnectAccountId || '').trim();
    if (!stripeConnectAccountId) {
      const user = await getUserById(session.userId).catch(() => null);
      const account = await stripe.accounts.create({
        type: 'express',
        email: user?.email || undefined,
        metadata: {
          providerId: session.userId,
          ivywayProviderProfileId: provider.id,
        },
      });

      stripeConnectAccountId = account.id;
      const updated = await updateProvider(provider.id, { stripeConnectAccountId });
      if (!updated) {
        return NextResponse.json({ error: 'Failed to persist Stripe Connect account ID' }, { status: 500 });
      }
    }

    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const appUrl = rawAppUrl.replace(/\/$/, ''); // normalize trailing slash
    const returnUrl = `${appUrl}/dashboard/earnings/withdraw`;
    const refreshUrl = `${appUrl}/dashboard/earnings/withdraw`;

    const link = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: link.url }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/stripe/connect/create-account-link]' });
  }
}


