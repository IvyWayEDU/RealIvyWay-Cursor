import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createSessionsFromBookingState } from '@/lib/sessions/actions';

/**
 * API endpoint to create sessions from booking state and create Zoom meetings
 * Called after successful payment
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
    const { bookingState } = body;

    if (!bookingState) {
      return NextResponse.json(
        { error: 'Booking state is required' },
        { status: 400 }
      );
    }

    // Create sessions and Zoom meetings
    const result = await createSessionsFromBookingState(bookingState);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessions: result.sessions,
    });
  } catch (error) {
    console.error('Error creating sessions:', error);
    return NextResponse.json(
      {
        error: 'Failed to create sessions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
