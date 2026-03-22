import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { checkAndMarkNoShows } from '@/lib/sessions/noShowDetection';
import { handleApiError } from '@/lib/errorHandler';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { checkNoShowsSchema } from '@/lib/validation/schemas';

/**
 * API endpoint to check and mark no-show sessions
 * This can be called periodically (e.g., via cron job) to automatically detect no-shows
 * 
 * SECURITY: Admin access required
 * Optional query parameter: sessionId - to check a specific session
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin role
    const authResult = await auth.requireAdmin();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    // Validate request body with schema
    const validationResult = await validateRequestBody(request, checkNoShowsSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { sessionId } = validationResult.data;

    // Check and mark no-shows
    const result = await checkAndMarkNoShows(sessionId);

    return NextResponse.json({
      success: result.success,
      markedNoShows: result.markedNoShows,
      errors: result.errors,
      message: `Checked sessions. Marked ${result.markedNoShows.length} as no-show.`,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/check-no-shows]' });
  }
}





