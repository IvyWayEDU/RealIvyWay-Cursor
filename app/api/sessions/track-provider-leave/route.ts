import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { trackProviderLeft } from '@/lib/sessions/actions';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { sessionTrackingSchema } from '@/lib/validation/schemas';

/**
 * Track when provider leaves Zoom meeting
 * Called when provider leaves the Zoom session
 * 
 * SECURITY: Authentication and provider role required, ownership verified
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and provider role
    const authResult = await auth.requireProvider();
    if (authResult.error) {
      console.warn('[SECURITY] Unauthorized access attempt to /api/sessions/track-provider-leave');
      return authResult.error;
    }
    const session = authResult.session!;
    
    // Validate request body with schema
    const validationResult = await validateRequestBody(request, sessionTrackingSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { sessionId } = validationResult.data;

    // SECURITY: Verify session ownership (IDOR protection)
    const ownershipCheck = await auth.checkSessionOwnership(session, sessionId);
    if (ownershipCheck) return ownershipCheck;

    // SECURITY: trackProviderLeft also checks ownership internally
    const result = await trackProviderLeft(sessionId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to track provider leave' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      thresholdMet: result.thresholdMet,
      accumulatedSeconds: result.accumulatedSeconds,
    });
  } catch (error) {
    console.error('Error tracking provider leave:', error);
    return NextResponse.json(
      { 
        error: 'Failed to track provider leave',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

