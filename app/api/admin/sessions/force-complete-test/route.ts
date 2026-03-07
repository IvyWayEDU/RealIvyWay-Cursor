import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth.requireAdmin();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const body = await request.json();
    const sessionId = String(body?.sessionId || '').trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const nowISO = new Date().toISOString();

    // Force completion by calling the same canonical completion handler used elsewhere.
    // This must NOT modify the normal time-based resolver/scheduler behavior.
    await markSessionCompletedWithEarnings(sessionId, 'admin_force_complete_test', {
      completedAt: nowISO,
      actualStartTime: (existing as any)?.actualStartTime || (existing as any)?.providerJoinedAt || undefined,
      actualEndTime: nowISO,
      completionReason: 'ADMIN_TEST_OVERRIDE',
      creditEarnings: true,
      completedByAdminTest: true,
    });

    await appendAdminAuditEntry({
      action: 'FORCE_COMPLETE_SESSION_TEST',
      adminUserId: session.userId,
      sessionId,
      timestamp: nowISO,
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error('Admin force complete test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



