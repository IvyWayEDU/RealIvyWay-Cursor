import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { backfillMissingZoomUrls } from '@/lib/sessions/actions';

/**
 * API endpoint to backfill missing Zoom URLs for sessions
 * This can be called to ensure all sessions with Zoom meeting IDs have join URLs
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const auth = await getAuthContext();
    if (auth.status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    if (auth.status !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Backfill missing Zoom URLs
    const result = await backfillMissingZoomUrls();

    return NextResponse.json({
      success: result.success,
      backfilledCount: result.backfilledCount,
      error: result.error,
    });
  } catch (error) {
    console.error('[API /api/sessions/backfill-zoom] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to backfill Zoom URLs', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}





