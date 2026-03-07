import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // STRICT BOOKING FLOW:
  // Sessions may ONLY be created inside the Stripe webhook AFTER paymentIntent.status === "succeeded".
  return NextResponse.json(
    { error: 'Direct session creation is disabled. Complete payment to create a session.' },
    { status: 403 }
  );
}

