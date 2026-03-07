import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to confirm payment and create Zoom meetings
 * Called after successful Stripe payment
 */
export async function POST(request: NextRequest) {
  // STRICT BOOKING FLOW:
  // Payment confirmation + session creation happens via Stripe webhook only.
  return NextResponse.json(
    { error: 'Disabled. Sessions are created via Stripe webhook after successful payment.' },
    { status: 403 }
  );
}
