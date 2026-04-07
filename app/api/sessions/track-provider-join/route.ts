import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { trackProviderJoinUnified } from '@/lib/sessions/unified-resolver';
import { resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';
import { handleApiError } from '@/lib/errorHandler';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { sessionTrackingSchema } from '@/lib/validation/schemas';

/**
 * Track when provider joins Zoom meeting
 * Called when provider clicks Join Session button
 * 
 * SECURITY: Authentication and provider role required, ownership verified in trackProviderJoined
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and provider role
    const authResult = await auth.requireProvider();
    if (authResult.error) {
      console.warn('[SECURITY] Unauthorized access attempt to /api/sessions/track-provider-join');
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

    // SECURITY: trackProviderJoined also checks ownership internally
    const result = await trackProviderJoinUnified(sessionId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to track provider join' },
        { status: 400 }
      );
    }

    // Ensure status transitions (completed/no-show) are persisted promptly after join evidence.
    // This is idempotent and safe to run on every join click.
    await resolveUnifiedSessions('provider_join');

    console.log('[PROVIDER_ZOOM_JOIN]', {
      sessionId,
      providerUserId: session.userId,
      joinedWithinWindow: result.joinedWithinWindow,
      source: 'ui_click',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/track-provider-join]' });
  }
}



