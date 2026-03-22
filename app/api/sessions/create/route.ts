import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // STRICT BOOKING FLOW:
    // Sessions may ONLY be created inside the Stripe webhook AFTER paymentIntent.status === "succeeded".
    return NextResponse.json(
      { error: 'Direct session creation is disabled. Complete payment to create a session.' },
      { status: 403 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/create]' });
  }
}

