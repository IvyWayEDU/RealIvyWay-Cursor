import 'server-only';

import { Session } from '@/lib/models/types';

/**
 * Centralized session status resolver (canonical lifecycle).
 *
 * REQUIRED BEHAVIOR:
 * - A session becomes `completed` ONLY when:
 *   currentTimeUTC >= session.scheduledEnd
 *
 * Notes:
 * - Caller is responsible for persisting returned patch.
 */

export function getSessionEndTimeIso(session: Session): string | null {
  const s: any = session;
  const iso =
    (typeof s?.endTime === 'string' && s.endTime) ||
    (typeof s?.scheduledEndTime === 'string' && s.scheduledEndTime) ||
    (typeof s?.scheduledEnd === 'string' && s.scheduledEnd) ||
    null;
  return iso;
}

export function getSessionEndTimeMs(session: Session): number | null {
  const iso = getSessionEndTimeIso(session);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

type AttendanceFlag = 'none' | 'provider_no_show' | 'full_no_show';

function toIsoStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return d.toISOString();
}

function resolveAttendanceAndPayout(session: Session): {
  providerJoinedAt: string | null;
  studentJoinedAt: string | null;
  attendanceFlag: AttendanceFlag;
  providerEligibleForPayout: boolean;
  providerJoinCount: number;
  studentJoinCount: number;
} {
  const providerJoinedAt = toIsoStringOrNull((session as any)?.providerJoinedAt);
  const studentJoinedAt = toIsoStringOrNull((session as any)?.studentJoinedAt);

  const logs: any[] = Array.isArray((session as any)?.zoomJoinLogs) ? (session as any).zoomJoinLogs : [];
  const providerJoinCountFromLogs = logs.filter((l) => String(l?.role || '').toLowerCase() === 'provider').length;
  const studentJoinCountFromLogs = logs.filter((l) => String(l?.role || '').toLowerCase() === 'student').length;
  const providerJoinCount = providerJoinCountFromLogs > 0 ? providerJoinCountFromLogs : providerJoinedAt ? 1 : 0;
  const studentJoinCount = studentJoinCountFromLogs > 0 ? studentJoinCountFromLogs : studentJoinedAt ? 1 : 0;

  if (providerJoinCount > 0) {
    return {
      providerJoinedAt,
      studentJoinedAt,
      attendanceFlag: 'none',
      providerEligibleForPayout: true,
      providerJoinCount,
      studentJoinCount,
    };
  }

  if (studentJoinCount > 0 && providerJoinCount === 0) {
    return {
      providerJoinedAt: null,
      studentJoinedAt,
      attendanceFlag: 'provider_no_show',
      providerEligibleForPayout: false,
      providerJoinCount,
      studentJoinCount,
    };
  }

  // If we have no evidence either party joined (common in dev/test flows or missing Zoom logs),
  // do NOT automatically withhold payout. We only withhold when we have positive evidence
  // the student joined but the provider did not.
  return {
    providerJoinedAt: providerJoinedAt ?? null,
    studentJoinedAt: studentJoinedAt ?? null,
    attendanceFlag: 'none',
    providerEligibleForPayout: true,
    providerJoinCount,
    studentJoinCount,
  };
}

export function resolveSessionStatusByTime(
  session: Session,
  nowMs: number = Date.now()
): Partial<Session> | null {
  // Do not auto-resolve cancelled sessions.
  const status = typeof (session as any)?.status === 'string' ? String((session as any).status) : '';
  if (status === 'cancelled' || status === 'cancelled-late' || status === 'refunded') return null;

  const endIso = (session as any)?.scheduledEnd || (session as any)?.scheduledEndTime || (session as any)?.endTime;
  if (typeof endIso !== 'string' || !endIso.trim()) return null;
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(endMs)) return null;

  if (nowMs < endMs) return null;

  // If already completed, no status transition patch is needed.
  if (status === 'completed') return null;

  const nowISO = new Date(nowMs).toISOString();
  const zoomMeetingId = (session as any)?.zoomMeetingId ? String((session as any).zoomMeetingId).trim() : '';
  const hasZoomMeetingId = Boolean(zoomMeetingId);

  const { providerJoinedAt, studentJoinedAt, attendanceFlag, providerEligibleForPayout, providerJoinCount, studentJoinCount } =
    resolveAttendanceAndPayout(session);

  // Treat provider payout eligibility as the source of truth for whether the provider earned.
  // Missing Zoom meeting IDs / join logs are not, by themselves, evidence of a no-show.
  const providerEarned = Boolean(providerEligibleForPayout);
  const flagNoShowProvider = !providerEarned;

  console.log('[SESSION_RESOLVED]', {
    sessionId: String((session as any)?.id || ''),
    zoomMeetingId: hasZoomMeetingId ? zoomMeetingId : null,
    providerJoinCount,
    studentJoinCount,
    attendanceFlag,
    payoutEligible: providerEligibleForPayout,
    providerEarned,
    flagNoShowProvider,
  });

  const patch: any = {
    status: 'completed',
    completedAt: nowISO,
    updatedAt: nowISO,
    providerJoinedAt,
    studentJoinedAt,
    attendanceFlag,
    providerEligibleForPayout,
    providerEarned,
    flagNoShowProvider,
    providerJoinCount,
    studentJoinCount,
    attendanceCheckedAt: nowISO,
    attendanceSource: hasZoomMeetingId ? 'zoom' : 'missing_zoom_meeting_id',
  };

  // Add an entry to admin flagged sessions when provider did not attend.
  if (flagNoShowProvider) {
    patch.flaggedAt = nowISO;
    patch.flaggedReason = hasZoomMeetingId ? 'NO_SHOW_PROVIDER' : 'NO_SHOW_PROVIDER_MISSING_ZOOM_MEETING_ID';
    patch.noShowParty = 'provider';
    patch.providerEligibleForPayout = false;
  }

  return patch as Partial<Session>;
}


