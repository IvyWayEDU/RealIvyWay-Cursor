import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/auth/storage';
import { createZoomMeetingForSession } from '@/lib/sessions/actions';
import { updateDevSession } from '@/lib/devSessionStore';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-09-30.acacia',
    })
  : null;

/**
 * API endpoint to confirm payment and create Zoom meetings
 * Called after successful Stripe payment
 */
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

    const body = await request.json();
    const { sessionId, paymentIntentId, checkoutSessionId } = body;

    // Verify payment with Stripe
    if (stripe) {
      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: 'Payment not confirmed' },
            { status: 400 }
          );
        }
      } else if (checkoutSessionId) {
        const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
        if (checkoutSession.payment_status !== 'paid') {
          return NextResponse.json(
            { error: 'Payment not confirmed' },
            { status: 400 }
          );
        }
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Update session status to paid
    updateDevSession(sessionId, {
      status: 'scheduled', // Use 'scheduled' status for confirmed bookings
      updatedAt: new Date().toISOString(),
    });

    // Create Zoom meeting for the session
    const zoomResult = await createZoomMeetingForSession(sessionId);

    if (zoomResult.success && zoomResult.zoomJoinUrl && zoomResult.zoomMeetingId) {
      // Update session with Zoom meeting data
      updateDevSession(sessionId, {
        zoomJoinUrl: zoomResult.zoomJoinUrl,
        zoomMeetingId: zoomResult.zoomMeetingId,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Log error but don't fail the booking
      console.error('Failed to create Zoom meeting for session:', sessionId, zoomResult.error);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      zoomMeetingCreated: zoomResult.success,
      zoomJoinUrl: zoomResult.zoomJoinUrl,
      zoomMeetingId: zoomResult.zoomMeetingId,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to confirm payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
