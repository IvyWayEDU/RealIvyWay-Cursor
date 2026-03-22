import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String((body as any)?.sessionId ?? '').trim();
    const note = String((body as any)?.note ?? '').trim();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const existing = await getSessionById(sessionId);
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const nowISO = new Date().toISOString();
    const ok = await updateSession(sessionId, {
      status: 'cancelled',
      cancelledAt: nowISO,
      cancelledBy: authResult.session!.userId,
      cancellationReason: 'admin-request',
      cancellationNote: note || undefined,
      updatedAt: nowISO,
    } as any);
    if (!ok) return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 });

    await appendAdminAuditEntry({
      action: 'CANCEL_SESSION',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/cancel]' });
  }
}


