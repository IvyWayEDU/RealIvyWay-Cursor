import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/auth/session';

// Initialize Stripe with secret key from environment variable
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      serviceName,
      planName,
      totalPrice,
      quantity,
      bookingId,
    } = body;

    // Validate required fields
    if (!serviceName || !planName || !totalPrice || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Convert price to cents (Stripe uses cents)
    const amountInCents = Math.round(parseFloat(totalPrice) * 100);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        userId: session.userId,
        bookingId: bookingId || 'placeholder',
        serviceName,
        planName,
        serviceType: serviceName, // For consistency with requirements
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
    console.error('Error creating PaymentIntent:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
