import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthContext } from '@/lib/auth/session';
import { getStripePriceIdForPricingKey } from '@/lib/pricing/stripePriceIds';
import { getCatalogItemByKey } from '@/lib/pricing/catalog';
import { handleApiError } from '@/lib/errorHandler';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' })
  : null;

/**
 * POST /api/counseling/subscribe
 * Creates a Stripe Checkout Session to start the Monthly Counseling Plan subscription.
 * This does NOT book any sessions; credits are granted via Stripe webhooks.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (auth.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }
    if (auth.status !== 'ok') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = auth.session;

    if (!stripe) {
      console.warn('Stripe API key not configured. Returning mock checkout URL.');
      return NextResponse.json({ url: null, mock: true });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';

    // Source of truth pricing key for monthly counseling subscription
    const pricing_key = 'counseling_monthly' as const;
    const stripePriceId = getStripePriceIdForPricingKey(pricing_key);
    const catalog = getCatalogItemByKey(pricing_key);

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      allow_promotion_codes: false,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/dashboard/book/success?session_id={CHECKOUT_SESSION_ID}&kind=counseling_monthly`,
      cancel_url: `${baseUrl}/dashboard/book/summary?canceled=true`,
      metadata: {
        userId: session.userId,
        bookingSchemaVersion: 'strict_v1',
        // Pricing snapshot for webhook routing/audit
        service_type: 'counseling',
        plan: 'monthly',
        duration_minutes: '60',
        pricing_key,
        stripe_price_id: stripePriceId,
        purchase_price_cents: String(catalog.purchase_price_cents),
        session_count: String(catalog.sessions_per_purchase), // 4 credits/month
      },
      // Propagate metadata onto the Subscription so invoice.paid can grant credits on renewals.
      subscription_data: {
        metadata: {
          userId: session.userId,
          pricing_key,
          service_type: 'counseling',
          plan: 'monthly',
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/counseling/subscribe]' });
  }
}



