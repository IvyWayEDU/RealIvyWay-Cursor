import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthContext } from '@/lib/auth/session';
import { getSessionPricingCents, Plan as PricingPlan, ServiceType as PricingServiceType } from '@/lib/pricing/catalog';
import { ensureStripeCustomerForUser } from '@/lib/stripe/ensureCustomer.server';
import { handleApiError } from '@/lib/errorHandler';

// Initialize Stripe with secret key from environment variable
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const auth = await getAuthContext();
    if (auth.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }
    if (auth.status !== 'ok') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = auth.session;

    // Parse request body
    const body = await request.json();
    const {
      bookingId,
      service_type,
      plan,
      duration_minutes,
    } = body;

    // Validate required fields
    if (!service_type || !plan) {
      return NextResponse.json(
        { error: 'Missing required fields: service_type, plan' },
        { status: 400 }
      );
    }

    // Check if Stripe is configured
    if (!stripe) {
      console.warn('Stripe API key not configured. Returning mock payment intent.');
      return NextResponse.json({
        clientSecret: null,
        mock: true,
      });
    }

    const svcNorm = String(service_type).trim().toLowerCase().replace(/-/g, '_');
    const serviceType: PricingServiceType | null =
      svcNorm === 'tutoring'
        ? 'tutoring'
        : svcNorm === 'counseling' || svcNorm === 'college_counseling'
          ? 'counseling'
          : svcNorm === 'test_prep' || svcNorm === 'testprep'
            ? 'test_prep'
            : svcNorm === 'virtual_tour' || svcNorm === 'virtual_tours'
              ? 'virtual_tour'
              : svcNorm === 'ivyway_ai'
                ? 'ivyway_ai'
                : null;
    if (!serviceType) {
      return NextResponse.json({ error: 'Unsupported service_type' }, { status: 400 });
    }

    const planNorm = String(plan).trim().toLowerCase();
    const pricingPlan: PricingPlan =
      planNorm === 'monthly' ? 'monthly' : planNorm === 'yearly' ? 'yearly' : 'single';

    // Counseling is 60 minutes only; ignore any legacy 30-minute duration input.
    const dur: 60 | null = serviceType === 'counseling' ? 60 : null;

    const pricing = getSessionPricingCents({ service_type: serviceType, plan: pricingPlan, duration_minutes: dur });
    const amountInCents = pricing.purchase_price_cents;

    // Ensure Stripe customer exists so any saved payment methods are associated to a customer.
    const ensured = await ensureStripeCustomerForUser(session.userId);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      ...(ensured.ok && ensured.stripeCustomerId ? { customer: ensured.stripeCustomerId } : {}),
      metadata: {
        userId: session.userId,
        bookingId: bookingId || 'placeholder',
        service_type: serviceType,
        plan: pricingPlan,
        duration_minutes: dur == null ? '' : String(dur),
        pricing_key: pricing.pricing_key,
        purchase_price_cents: String(pricing.purchase_price_cents),
        session_count: String(pricing.sessions_per_purchase),
        session_price_cents: String(pricing.session_price_cents),
        provider_payout_cents: String(pricing.provider_payout_cents),
        // Virtual Tours: provider compensation snapshot for downstream systems (USD dollars).
        providerPay: serviceType === 'virtual_tour' ? String(Math.floor(pricing.provider_payout_cents / 100)) : '',
        ivyway_take_cents: String(pricing.ivyway_take_cents),
      },
      // Enable automatic payment methods including Apple Pay and Google Pay
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/payment-intent]' });
  }
}
