import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { handleApiError } from '@/lib/errorHandler';

/**
 * Admin: Force mark a session completed (non-test).
 */
export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String((body as any)?.sessionId ?? '').trim();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const existing = await getSessionById(sessionId);
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if ((existing as any).status === 'cancelled' || (existing as any).status === 'cancelled-late') {
      return NextResponse.json({ error: 'Session cannot be completed' }, { status: 400 });
    }

    const nowISO = new Date().toISOString();
    await markSessionCompletedWithEarnings(sessionId, 'admin_force_complete', {
      completedAt: nowISO,
      actualStartTime: (existing as any)?.actualStartTime || (existing as any)?.providerJoinedAt || undefined,
      actualEndTime: nowISO,
      completionReason: 'ADMIN_FORCE_COMPLETE',
      creditEarnings: true,
      completedByAdminTest: false,
    });

    await appendAdminAuditEntry({
      action: 'FORCE_COMPLETE_SESSION',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/force-complete]' });
  }
}


