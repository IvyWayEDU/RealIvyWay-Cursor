import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { sendSessionFollowupEmailsForSession } from '@/lib/email/transactional';
import { getSessionById } from '@/lib/sessions/storage';

export const dynamic = 'force-dynamic';

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') || '';
  return authHeader === `Bearer ${secret}`;
}

type CandidateRow = {
  id: string;
  status: string;
  followup_sent: boolean;
  end_datetime: string | null;
  datetime: string;
  data: any;
};

function completionIsoFromRow(row: CandidateRow): string | null {
  const dataCompletedAt = typeof row?.data?.completedAt === 'string' ? String(row.data.completedAt).trim() : '';
  if (dataCompletedAt) return dataCompletedAt;

  const actualEndTime = typeof row?.data?.actualEndTime === 'string' ? String(row.data.actualEndTime).trim() : '';
  if (actualEndTime) return actualEndTime;

  if (row?.end_datetime) return String(row.end_datetime);
  if (row?.datetime) return String(row.datetime);
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Jobs can automatically attach `Authorization: Bearer ${CRON_SECRET}`.
    // We return 404 (not 401) to avoid advertising the endpoint to scanners.
    if (!isAuthorizedCronRequest(request)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const nowMs = Date.now();
    const minAgeMinutes = Number(process.env.FOLLOWUP_MIN_AGE_MINUTES || 60);
    const minAgeMs = Math.max(0, Math.floor(minAgeMinutes * 60 * 1000));

    const sendProviderThankYou = String(process.env.FOLLOWUP_SEND_PROVIDER_THANK_YOU || 'true').toLowerCase() !== 'false';
    const maxBatch = Math.min(200, Math.max(1, Number(process.env.FOLLOWUP_MAX_BATCH || 50)));

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('sessions')
      .select('id, status, followup_sent, datetime, end_datetime, data')
      .eq('status', 'completed')
      .eq('followup_sent', false)
      .order('end_datetime', { ascending: true })
      .limit(maxBatch);

    if (error) throw error;

    const rows = (data || []) as CandidateRow[];

    const eligible = rows.filter((row) => {
      const iso = completionIsoFromRow(row);
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (!Number.isFinite(t)) return false;
      return nowMs - t >= minAgeMs;
    });

    const results: Array<{
      sessionId: string;
      studentEmailSent: boolean;
      providerEmailSent: boolean;
      markedFollowupSent: boolean;
      errors?: string[];
    }> = [];

    for (const row of eligible) {
      const sessionId = String(row.id || '').trim();
      if (!sessionId) continue;

      const session = await getSessionById(sessionId);
      if (!session) {
        results.push({
          sessionId,
          studentEmailSent: false,
          providerEmailSent: false,
          markedFollowupSent: false,
          errors: ['Session not found'],
        });
        continue;
      }

      const send = await sendSessionFollowupEmailsForSession(session as any, {
        sendProviderThankYou,
      });

      let markedFollowupSent = false;
      if (send.studentEmailSent) {
        const { error: updateErr } = await supabase
          .from('sessions')
          .update({ followup_sent: true })
          .eq('id', sessionId)
          .eq('followup_sent', false);
        if (updateErr) {
          results.push({
            sessionId,
            studentEmailSent: send.studentEmailSent,
            providerEmailSent: send.providerEmailSent,
            markedFollowupSent: false,
            errors: [...(send.errors || []), `Failed to mark followup_sent: ${updateErr.message}`],
          });
          continue;
        }
        markedFollowupSent = true;
      }

      results.push({
        sessionId,
        studentEmailSent: send.studentEmailSent,
        providerEmailSent: send.providerEmailSent,
        markedFollowupSent,
        errors: send.errors,
      });
    }

    const sentCount = results.filter((r) => r.studentEmailSent).length;
    const markedCount = results.filter((r) => r.markedFollowupSent).length;
    const erroredCount = results.filter((r) => (r.errors || []).length > 0).length;

    return NextResponse.json({
      ok: true,
      now: new Date(nowMs).toISOString(),
      considered: rows.length,
      eligible: eligible.length,
      sent: sentCount,
      marked: markedCount,
      errored: erroredCount,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/cron/session-followups] error', { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

