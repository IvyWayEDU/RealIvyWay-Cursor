import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/getServerSession';
import { processSessionLifecycle, checkAndResolveAllUnresolvedSessions } from '@/lib/sessions/actions';
import { getSessionsByStudentId, getSessionsByProviderId } from '@/lib/sessions/storage';
import { handleApiError } from '@/lib/errorHandler';

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
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const RoleSchema = z.object({
      role: z.enum(['student', 'provider', 'all']).default('student'),
    }).strict();
    const parsed = RoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const role = parsed.data.role;

    // If checking all sessions, verify admin access
    if (role === 'all') {
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

    // Enforce role-based access (students cannot run provider checks, etc.)
    if (role === 'provider' && !session.roles.includes('provider')) {
      return NextResponse.json({ error: 'Forbidden: Provider role required' }, { status: 403 });
    }
    if (role === 'student' && !session.roles.includes('student')) {
      return NextResponse.json({ error: 'Forbidden: Student role required' }, { status: 403 });
    }

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
    return handleApiError(error, { logPrefix: '[api/sessions/reliability]' });
  }
}

