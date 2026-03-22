import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errorHandler';

/**
 * API endpoint to create sessions from booking state and create Zoom meetings
 * Called after successful payment
 */
export async function POST(request: NextRequest) {
  try {
    // STRICT BOOKING FLOW:
    // Sessions are persisted ONLY by Stripe webhook after paymentIntent.status === "succeeded".
    // This endpoint is intentionally disabled to prevent UI-created sessions / duplicates.
    return NextResponse.json(
      { error: 'Disabled. Sessions are created via Stripe webhook after successful payment.' },
      { status: 403 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/create-sessions]' });
  }
}
