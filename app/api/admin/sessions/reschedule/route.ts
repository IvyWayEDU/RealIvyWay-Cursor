import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { createZoomMeeting, isZoomConfigured } from '@/lib/zoom/api';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { handleApiError } from '@/lib/errorHandler';
import { sendRescheduleEmails } from '@/lib/email/transactional';

function toIsoOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String((body as any)?.sessionId ?? '').trim();
    const newStartIso = toIsoOrNull((body as any)?.newStartTime || (body as any)?.startTime);
    const newEndIso = toIsoOrNull((body as any)?.newEndTime || (body as any)?.endTime);
    const note = String((body as any)?.note ?? '').trim();

    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    if (!newStartIso || !newEndIso) return NextResponse.json({ error: 'newStartTime and newEndTime are required' }, { status: 400 });
    if (new Date(newEndIso).getTime() <= new Date(newStartIso).getTime()) {
      return NextResponse.json({ error: 'newEndTime must be after newStartTime' }, { status: 400 });
    }

    const before = await getSessionById(sessionId);
    if (!before) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const nowISO = new Date().toISOString();
    const ok = await updateSession(sessionId, {
      startTime: newStartIso,
      endTime: newEndIso,
      scheduledStartTime: newStartIso,
      scheduledEndTime: newEndIso,
      scheduledStart: newStartIso,
      scheduledEnd: newEndIso,
      rescheduledAt: nowISO,
      rescheduledBy: authResult.session!.userId,
      rescheduleNote: note || undefined,
      updatedAt: nowISO,
    } as any);
    if (!ok) return NextResponse.json({ error: 'Failed to reschedule session' }, { status: 500 });

    // Best-effort: create a fresh Zoom meeting for the new time.
    if (isZoomConfigured()) {
      try {
        const zoom = await createZoomMeeting({
          topic: 'IvyWay Session (Rescheduled)',
          startTime: newStartIso,
          duration: Math.max(1, Math.round((new Date(newEndIso).getTime() - new Date(newStartIso).getTime()) / (1000 * 60))),
        });

        const join_url = zoom.joinUrl;
        await updateSession(sessionId, {
          zoomMeetingId: zoom.meetingId,
          zoom_meeting_id: zoom.meetingId,
          zoom_join_url: join_url,
          zoomStartUrl: zoom.startUrl,
          zoom_start_url: zoom.startUrl,
          zoomStatus: 'created',
          updatedAt: new Date().toISOString(),
        } as any);

        // Persist to dedicated DB column
        try {
          const supabase = getSupabaseAdmin();
          const { error } = await supabase.from('sessions').update({ zoom_join_url: join_url }).eq('id', sessionId);
          if (error) throw error;
        } catch (e) {
          console.error('[ZOOM_JOIN_URL_DB_SAVE_FAILED]', {
            sessionId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } catch (e) {
        console.error('[ZOOM_MEETING_CREATE_FAILED][RESCHEDULE]', {
          sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
        try {
          await updateSession(sessionId, { zoomStatus: 'failed' } as any);
        } catch {}
      }
    }

    const after = await getSessionById(sessionId);
    if (!after) return NextResponse.json({ error: 'Failed to read rescheduled session' }, { status: 500 });

    // Transactional email: reschedule (idempotent per-session)
    try {
      const alreadyStudent = Boolean((after as any)?.rescheduleEmailStudentSentAt);
      const alreadyProvider = Boolean((after as any)?.rescheduleEmailProviderSentAt);
      if (!alreadyStudent || !alreadyProvider) {
        const sendResult = await sendRescheduleEmails({ before: before as any, after: after as any });
        const sentAt = new Date().toISOString();
        await updateSession(sessionId, {
          rescheduleEmailStudentSentAt: sendResult.studentEmailSent ? sentAt : (after as any)?.rescheduleEmailStudentSentAt,
          rescheduleEmailProviderSentAt: sendResult.providerEmailSent ? sentAt : (after as any)?.rescheduleEmailProviderSentAt,
          rescheduleEmailsSentAt:
            sendResult.studentEmailSent && sendResult.providerEmailSent ? sentAt : (after as any)?.rescheduleEmailsSentAt,
          updatedAt: sentAt,
        } as any);
      }
    } catch (e) {
      console.warn('[email] reschedule send failed (non-blocking)', {
        sessionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const final = await getSessionById(sessionId);
    return NextResponse.json({ success: true, session: final }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/reschedule]' });
  }
}

