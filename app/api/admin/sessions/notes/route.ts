import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSessionLenient } from '@/lib/sessions/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String((body as any)?.sessionId ?? '').trim();
    const adminNotes = String((body as any)?.adminNotes ?? '').trim();
    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const existing = await getSessionById(sessionId);
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const nowISO = new Date().toISOString();
    const ok = await updateSessionLenient(sessionId, {
      adminNotes,
      updatedAt: nowISO,
    } as any);
    if (!ok) return NextResponse.json({ error: 'Failed to save notes' }, { status: 500 });

    await appendAdminAuditEntry({
      action: 'UPDATE_SESSION_NOTES',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/notes]' });
  }
}

