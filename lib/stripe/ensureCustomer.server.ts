import Stripe from 'stripe';
import { getUserById, updateUser } from '@/lib/auth/storage';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    })
  : null;

export async function ensureStripeCustomerForUser(userId: string): Promise<{
  ok: boolean;
  stripeCustomerId?: string;
  error?: string;
}> {
  const user = await getUserById(userId);
  if (!user) return { ok: false, error: 'User not found' };

  const existing = typeof user.stripeCustomerId === 'string' ? user.stripeCustomerId.trim() : '';
  if (existing) return { ok: true, stripeCustomerId: existing };

  if (!stripe) {
    return { ok: false, error: 'Stripe is not configured (missing STRIPE_SECRET_KEY)' };
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  await updateUser(user.id, {
    stripeCustomerId: customer.id,
    stripeCustomerEmail: customer.email || user.email,
    stripeCustomerName: customer.name || user.name,
    stripeCustomerCreatedAt: new Date().toISOString(),
  } as any);

  return { ok: true, stripeCustomerId: customer.id };
}


