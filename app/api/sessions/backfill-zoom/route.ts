import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { backfillMissingZoomUrls } from '@/lib/sessions/actions';
import { handleApiError } from '@/lib/errorHandler';

/**
 * API endpoint to backfill missing Zoom URLs for sessions
 * This can be called to ensure all sessions with Zoom meeting IDs have join URLs
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: admin-only maintenance endpoint
    const authResult = await auth.requireAdmin();
    if (authResult.error) return authResult.error;
    void request;

    // Backfill missing Zoom URLs
    const result = await backfillMissingZoomUrls();

    return NextResponse.json({
      success: result.success,
      backfilledCount: result.backfilledCount,
      error: result.error,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/backfill-zoom]' });
  }
}





