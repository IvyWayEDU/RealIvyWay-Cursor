import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureStripeCustomerForUser } from '@/lib/stripe/ensureCustomer.server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ensure we have a Stripe customer (required for portal)
  const ensured = user.stripeCustomerId ? { ok: true, stripeCustomerId: user.stripeCustomerId } : await ensureStripeCustomerForUser(user.id);
  if (!ensured.ok || !ensured.stripeCustomerId) {
    return NextResponse.json({ error: ensured.error || 'No Stripe customer found' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get('origin') || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: ensured.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/profile`,
  });

  return NextResponse.json({ url: session.url });
}


