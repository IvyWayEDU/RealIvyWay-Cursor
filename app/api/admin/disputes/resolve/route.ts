import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeStatus(v: unknown): string {
  return cleanString(v).toLowerCase();
}

const ALLOWED_OUTCOMES = new Set([
  'confirmed',
  'completed',
  'cancelled',
  'provider_no_show',
  'student_no_show',
  'refunded',
]);

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const disputeId = cleanString((body as any)?.disputeId);
    const resolution = cleanString((body as any)?.resolution);
    const outcomeStatusRaw = normalizeStatus((body as any)?.outcomeStatus);

    if (!disputeId) return NextResponse.json({ error: 'disputeId is required' }, { status: 400 });
    if (!resolution) return NextResponse.json({ error: 'resolution is required' }, { status: 400 });

    const outcomeStatus = outcomeStatusRaw && outcomeStatusRaw !== 'scheduled' ? outcomeStatusRaw : 'confirmed';
    if (outcomeStatus && !ALLOWED_OUTCOMES.has(outcomeStatus)) {
      return NextResponse.json({ error: `Invalid outcomeStatus. Allowed: ${Array.from(ALLOWED_OUTCOMES).join(', ')}` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: disputeRow, error: disputeErr } = await supabase
      .from('session_disputes')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();
    if (disputeErr) throw disputeErr;
    if (!disputeRow) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

    const sessionId = cleanString((disputeRow as any)?.session_id);
    if (!sessionId) return NextResponse.json({ error: 'Dispute is missing session_id' }, { status: 500 });

    const nowISO = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('session_disputes')
      .update({
        status: 'resolved',
        resolution,
        resolved_at: nowISO,
        resolved_by: authResult.session!.userId,
      } as any)
      .eq('id', disputeId);
    if (updErr) throw updErr;

    const existingSession = await getSessionById(sessionId);
    if (!existingSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Resolve session status back into a terminal/non-disputed outcome.
    const ok = await updateSession(sessionId, {
      status: outcomeStatus,
      disputeResolvedAt: nowISO,
      disputeResolvedBy: authResult.session!.userId,
      disputeResolution: resolution,
      requiresAdminReview: false,
      updatedAt: nowISO,
    } as any);
    if (!ok) return NextResponse.json({ error: 'Failed to update session after dispute resolution' }, { status: 500 });

    await appendAdminAuditEntry({
      action: 'RESOLVE_DISPUTE',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
      metadata: { disputeId, outcomeStatus, resolution },
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ success: true, disputeId, session: updated }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/disputes/resolve]' });
  }
}

