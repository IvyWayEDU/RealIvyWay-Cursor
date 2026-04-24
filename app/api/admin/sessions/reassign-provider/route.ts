import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { getUserById } from '@/lib/auth/storage';
import { getProviderByUserId } from '@/lib/providers/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isTerminalStatus(status: string): boolean {
  const s = status.trim();
  return s === 'completed' || s === 'cancelled' || s === 'provider_no_show' || s === 'student_no_show' || s === 'refunded';
}

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = cleanString((body as any)?.sessionId);
    const newProviderId = cleanString((body as any)?.newProviderId);
    const note = cleanString((body as any)?.note);

    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    if (!newProviderId) return NextResponse.json({ error: 'newProviderId is required' }, { status: 400 });

    const existing = await getSessionById(sessionId);
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const s: any = existing as any;
    const status = cleanString(s?.status);
    if (isTerminalStatus(status)) {
      return NextResponse.json({ error: `Cannot reassign provider for a terminal session (status="${status}").` }, { status: 400 });
    }

    const oldProviderId = cleanString(s?.providerId);
    if (oldProviderId && oldProviderId === newProviderId) {
      return NextResponse.json({ success: true, session: existing }, { status: 200 });
    }

    // Validate new provider exists and has provider context.
    const [newProviderUser, newProviderProfile] = await Promise.all([
      getUserById(newProviderId),
      getProviderByUserId(newProviderId),
    ]);

    if (!newProviderUser) return NextResponse.json({ error: 'New provider user not found' }, { status: 404 });
    const roles = Array.isArray((newProviderUser as any)?.roles) ? ((newProviderUser as any).roles as string[]) : [];
    const hasProviderRole = roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor');
    if (!hasProviderRole && !newProviderProfile) {
      return NextResponse.json({ error: 'New provider is not a provider account' }, { status: 400 });
    }

    const startIso = cleanString(s?.startTime || s?.scheduledStartTime || s?.scheduledStart || s?.datetime);
    const endIso = cleanString(s?.endTime || s?.scheduledEndTime || s?.scheduledEnd || s?.end_datetime);
    if (!startIso || !endIso) return NextResponse.json({ error: 'Session is missing start/end time' }, { status: 400 });

    // Prevent reassignment into an already-booked provider slot at the same time.
    try {
      const supabase = getSupabaseAdmin();
      const { data: dup, error: dupErr } = await supabase
        .from('sessions')
        .select('id,status')
        .eq('provider_id', newProviderId)
        .eq('datetime', startIso)
        .eq('end_datetime', endIso)
        .neq('status', 'cancelled')
        .limit(1);
      if (dupErr) throw dupErr;
      if (Array.isArray(dup) && dup.length > 0) {
        return NextResponse.json({ error: 'New provider already has a session booked at this time.' }, { status: 400 });
      }
    } catch (e) {
      console.warn('[admin/reassign-provider] duplicate check failed (non-blocking)', {
        sessionId,
        newProviderId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const nowISO = new Date().toISOString();
    const patch: any = {
      providerId: newProviderId,
      providerName:
        typeof (newProviderUser as any)?.name === 'string' && (newProviderUser as any).name.trim()
          ? String((newProviderUser as any).name).trim()
          : cleanString((newProviderUser as any)?.email) || newProviderId,
      reassignedProviderFrom: oldProviderId || undefined,
      reassignedProviderAt: nowISO,
      reassignedProviderBy: authResult.session!.userId,
      reassignedProviderNote: note || undefined,
      updatedAt: nowISO,
    };

    const ok = await updateSession(sessionId, patch);
    if (!ok) return NextResponse.json({ error: 'Failed to reassign provider' }, { status: 500 });

    // Best-effort: move availability slot booking marker when table exists.
    try {
      const supabase = getSupabaseAdmin();
      if (oldProviderId) {
        await supabase
          .from('availability_slots')
          .update({ is_booked: false } as any)
          .eq('provider_id', oldProviderId)
          .eq('start_time', startIso)
          .eq('end_time', endIso);
      }
      await supabase
        .from('availability_slots')
        .update({ is_booked: true } as any)
        .eq('provider_id', newProviderId)
        .eq('start_time', startIso)
        .eq('end_time', endIso)
        .eq('is_booked', false);
    } catch {
      // ignore
    }

    await appendAdminAuditEntry({
      action: 'REASSIGN_PROVIDER',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
      metadata: {
        oldProviderId: oldProviderId || null,
        newProviderId,
        note: note || undefined,
        startIso,
        endIso,
      },
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ success: true, session: updated }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/reassign-provider]' });
  }
}

