import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';
import { getSessions } from '@/lib/sessions/storage';
import { handleApiError } from '@/lib/errorHandler';

/**
 * SECURITY: Admin access required for dev routes
 */
export async function POST(request: NextRequest) {
  // Require dev mode only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  // SECURITY: Require authentication and admin role
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  const startedAt = new Date();
  const errors: string[] = [];

  try {
    console.log('[DEV_RESOLVE] Starting resolver run');
    
    // Get sessions before resolution
    const sessionsBefore = await getSessions();
    const eligibleBefore = sessionsBefore.filter(s => {
      const terminalStates = ['completed', 'provider_no_show', 'student_no_show', 'cancelled', 'cancelled-late', 'refunded', 'requires_review', 'no_show_provider', 'no_show_student', 'expired_provider_no_show', 'expired'];
      return !terminalStates.includes(s.status);
    });

    // Run the unified resolver
    await resolveUnifiedSessions('dev_resolve');

    // Get sessions after resolution
    const sessionsAfter = await getSessions();
    const completedAfter = sessionsAfter.filter(s => s.status === 'completed');
    const providerNoShowAfter = sessionsAfter.filter(s => s.status === 'provider_no_show');
    
    // Count transitions
    const transitionedCount = completedAfter.length - sessionsBefore.filter(s => s.status === 'completed').length;
    const providerNoShowCount = providerNoShowAfter.length - sessionsBefore.filter(s => s.status === 'provider_no_show').length;

    const endedAt = new Date();
    const nowISO = new Date().toISOString();

    const result = {
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      nowISO,
      totalSessionsChecked: eligibleBefore.length,
      eligibleCount: eligibleBefore.length,
      transitionedCount,
      completedCount: completedAfter.length,
      providerNoShowCount,
      errors,
    };

    console.log('[DEV_RESOLVE] Resolver run completed:', result);

    return NextResponse.json(result);
  } catch (error) {
    errors.push('Resolver run failed');
    return handleApiError(error, {
      logPrefix: '[api/dev/resolve-sessions]',
      logContext: {
        startedAt: startedAt.toISOString(),
        errors,
      },
    });
  }
}

