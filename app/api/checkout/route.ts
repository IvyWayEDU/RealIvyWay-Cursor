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

    // Parse request body (bookingState is passed but we hardcode the price)
    await request.json();

    // Check if Stripe is configured
    if (!stripe) {
      console.warn('Stripe API key not configured. Returning mock checkout URL.');
      return NextResponse.json({
        sessionId: 'mock_session_' + Date.now(),
        url: null,
        mock: true,
      });
    }

    // Hardcode price: $73.83 = 7383 cents
    const amountInCents = 7383;

    // Get base URL for redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (request.headers.get('origin') || 'http://localhost:3000');

    // Create Stripe Checkout Session
    // Stripe Checkout automatically enables Apple Pay, Google Pay, and other payment methods
    // when available based on customer location and device capabilities
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Cards are always enabled
      // Apple Pay, Google Pay, Cash App, Affirm, Klarna, Link, etc. are automatically
      // enabled by Stripe Checkout when available for the customer
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Booking Payment',
              description: 'Complete your booking payment',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/dashboard/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/book/summary?canceled=true`,
      metadata: {
        userId: session.userId,
        bookingId: 'booking_' + Date.now(),
      },
      // Enable 3D Secure for cards
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating Stripe Checkout Session:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
