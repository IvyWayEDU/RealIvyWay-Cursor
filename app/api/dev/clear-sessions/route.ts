import { clearUpcomingSessionsForDev } from '@/lib/sessions/devReset';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/errorHandler';

/**
 * DEV-ONLY: Clears ALL sessions (and therefore clears join tracking / completed / upcoming state).
 *
 * SECURITY: In dev, allow providers/admins to clear test sessions for faster iteration.
 */
export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Require authentication (dev-only route) and restrict to provider/admin.
    const authResult = await auth.require();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const isProvider = Array.isArray(session.roles) && session.roles.includes('provider');
    const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');
    if (!isProvider && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const deletedCount = await clearUpcomingSessionsForDev();
    console.log('[DEV CLEAR SESSIONS API] DEV-ONLY: Cleared', deletedCount, 'sessions');
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/dev/clear-sessions]' });
  }
}

