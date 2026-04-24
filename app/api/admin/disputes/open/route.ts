import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? `disp_${crypto.randomUUID()}`
    : `disp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = cleanString((body as any)?.sessionId);
    const reason = cleanString((body as any)?.reason);
    const note = cleanString((body as any)?.note);

    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    if (!reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 });

    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const s: any = session as any;
    const nowISO = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    // Create (or fetch) open dispute record.
    let disputeId = newId();
    try {
      const { error: insErr } = await supabase.from('session_disputes').insert({
        id: disputeId,
        session_id: sessionId,
        student_id: cleanString(s?.studentId) || null,
        provider_id: cleanString(s?.providerId) || null,
        status: 'open',
        opened_at: nowISO,
        opened_by: authResult.session!.userId,
        reason,
        metadata: note ? { note } : null,
      } as any);
      if (insErr) throw insErr;
    } catch (e) {
      // If an open dispute already exists, return it.
      const { data, error } = await supabase
        .from('session_disputes')
        .select('id,status')
        .eq('session_id', sessionId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = Array.isArray(data) && data.length ? (data[0] as any) : null;
      if (!row?.id) throw e;
      disputeId = String(row.id);
    }

    // Mark session as disputed for admin surfacing.
    const ok = await updateSession(sessionId, {
      status: 'disputed',
      disputeId,
      disputedAt: nowISO,
      disputedBy: authResult.session!.userId,
      disputeReason: reason,
      requiresAdminReview: true,
      adminNotes: note ? note : (s?.adminNotes ?? undefined),
      updatedAt: nowISO,
    } as any);
    if (!ok) return NextResponse.json({ error: 'Failed to mark session disputed' }, { status: 500 });

    await appendAdminAuditEntry({
      action: 'OPEN_DISPUTE',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
      metadata: { disputeId, reason, note: note || undefined },
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ success: true, disputeId, session: updated }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/disputes/open]' });
  }
}

