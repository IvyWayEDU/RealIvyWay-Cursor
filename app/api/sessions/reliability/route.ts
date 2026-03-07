import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { processSessionLifecycle, checkAndResolveAllUnresolvedSessions } from '@/lib/sessions/actions';
import { getSessionsByStudentId, getSessionsByProviderId } from '@/lib/sessions/storage';

/**
 * API endpoint to check and resolve session status based on join behavior
 * This handles session reliability automation on the server
 * 
 * Body parameters:
 * - role: 'student' | 'provider' | 'all' - determines which sessions to check
 *   - 'all': checks all unresolved sessions (requires admin or system call)
 *   - 'student' | 'provider': checks sessions for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const role = body.role || 'student'; // Default to student

    const auth = await getAuthContext();
    if (auth.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }

    // If checking all sessions, verify admin access
    if (role === 'all') {
      if (auth.status !== 'ok') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      const session = auth.session;

      // TEMP_ADMIN_MODE: Check if user is admin or temp admin
      const { isTempAdmin } = await import('@/lib/auth/tempAdmin');
      const isAdmin = session.roles.includes('admin') || isTempAdmin(session.userId);

      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Unauthorized: Only admins can check all sessions' },
          { status: 403 }
        );
      }

      // TEMPORARY DEV FIX: Disable automatic session resolution in development
      // Check and resolve all unresolved sessions - PRODUCTION ONLY
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          success: true,
          expiredCount: 0,
          resolvedCount: 0,
          message: 'Automatic session resolution disabled in development mode',
        });
      }

      const result = await checkAndResolveAllUnresolvedSessions();

      return NextResponse.json({
        success: result.success,
        expiredCount: result.expiredCount,
        resolvedCount: result.resolvedCount,
        error: result.error,
      });
    }

    // Verify user session for role-based checks
    if (auth.status !== 'ok') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const session = auth.session;

    let sessions = [];
    
    // Fetch sessions based on role
    if (role === 'student') {
      sessions = await getSessionsByStudentId(session.userId);
    } else if (role === 'provider') {
      sessions = await getSessionsByProviderId(session.userId);
    } else {
      return NextResponse.json(
        { error: 'Invalid role. Must be "student", "provider", or "all"' },
        { status: 400 }
      );
    }

    // TEMPORARY DEV FIX: Disable automatic session resolution in development
    // Process session lifecycle: handle startTime transitions and joinDeadline resolutions - PRODUCTION ONLY
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        transitionedCount: 0,
        resolvedCount: 0,
        message: 'Automatic session resolution disabled in development mode',
      });
    }

    const result = await processSessionLifecycle(sessions);

    return NextResponse.json({
      success: result.success,
      transitionedCount: result.transitionedCount,
      resolvedCount: result.resolvedCount,
      error: result.error,
    });
  } catch (error) {
    console.error('[API /api/sessions/reliability] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check session reliability', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

