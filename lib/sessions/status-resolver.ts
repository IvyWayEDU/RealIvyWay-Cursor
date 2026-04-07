import 'server-only';

import { Session } from '@/lib/models/types';

/**
 * Centralized session status resolver (canonical lifecycle).
 *
 * REQUIRED BEHAVIOR (per business rules):
 * - Provider attendance takes priority for outcome + payout.
 * - After the 10-minute grace window from scheduled start:
 *   - If providerJoinedAt IS NOT NULL → status = 'completed' (provider is paid), regardless of student join
 *   - If providerJoinedAt IS NULL → status = 'provider_no_show' (no payout)
 * - Student absence MUST NOT block provider payout.
 * - Optional analytics: if providerJoinedAt IS NOT NULL and studentJoinedAt IS NULL, mark internal no-show
 *   fields (e.g. flagNoShowStudent/noShowParty) but keep status as 'completed'.
 *
 * Notes:
 * - Caller is responsible for persisting the returned patch.
 */

export function getSessionEndTimeIso(session: Session): string | null {
  const s: any = session;
  const iso =
    (typeof s?.end_datetime === 'string' && s.end_datetime) ||
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

export function getSessionStartTimeIso(session: Session): string | null {
  const s: any = session;
  const iso =
    (typeof s?.datetime === 'string' && s.datetime) ||
    (typeof s?.startTime === 'string' && s.startTime) ||
    (typeof s?.scheduledStartTime === 'string' && s.scheduledStartTime) ||
    (typeof s?.scheduledStart === 'string' && s.scheduledStart) ||
    null;
  return iso;
}

export function getSessionStartTimeMs(session: Session): number | null {
  const iso = getSessionStartTimeIso(session);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

const GRACE_WINDOW_MS = 10 * 60 * 1000;

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
  providerEligibleForPayout: boolean; // provider join evidence (student does not block)
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

  // Provider payout eligibility:
  // - Provider must have join evidence
  // - Student join does NOT affect payout
  // Note: grace window is used for status resolution timing, not payout blocking.
  const providerEligibleForPayout = providerJoinCount > 0;

  if (providerJoinCount > 0) {
    return {
      providerJoinedAt,
      studentJoinedAt,
      attendanceFlag: 'none',
      providerEligibleForPayout,
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

  // If we have no evidence either party joined:
  // - providerJoinedAt is null → provider is NOT eligible for payout.
  return {
    providerJoinedAt: providerJoinedAt ?? null,
    studentJoinedAt: studentJoinedAt ?? null,
    attendanceFlag: 'none',
    providerEligibleForPayout: false,
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

  // Terminal statuses (do not auto-transition further).
  // Note: no-show statuses may later transition to `completed` if both parties eventually join.
  if (status === 'completed') return null;

  const nowISO = new Date(nowMs).toISOString();
  const zoomMeetingId = (session as any)?.zoomMeetingId ? String((session as any).zoomMeetingId).trim() : '';
  const hasZoomMeetingId = Boolean(zoomMeetingId);

  const { providerJoinedAt, studentJoinedAt, providerJoinCount, studentJoinCount } = resolveAttendanceAndPayout(session);

  const startMs = getSessionStartTimeMs(session);
  const endMs = getSessionEndTimeMs(session);
  const graceElapsed = Number.isFinite(startMs ?? NaN) && nowMs >= (startMs as number) + GRACE_WINDOW_MS;

  // Provider attendance takes priority:
  // After grace window, if provider joined at any point, resolve as completed (and pay provider),
  // even when the student never joined.
  if (providerJoinedAt && graceElapsed) {
    const studentNoShow = !studentJoinedAt;
    const providerEarned = true;
    const patch: any = {
      status: 'completed',
      completedAt: (session as any)?.completedAt || nowISO,
      updatedAt: nowISO,
      providerJoinedAt,
      studentJoinedAt,
      attendanceFlag: 'none',
      providerEligibleForPayout: true,
      providerEarned,
      flagNoShowProvider: false,
      flagNoShowStudent: studentNoShow,
      noShowParty: studentNoShow ? 'student' : null,
      markedNoShowAt: studentNoShow ? (session as any)?.markedNoShowAt || nowISO : (session as any)?.markedNoShowAt,
      providerJoinCount,
      studentJoinCount,
      attendanceCheckedAt: nowISO,
      attendanceSource: hasZoomMeetingId ? 'zoom' : 'missing_zoom_meeting_id',
    };
    return patch as Partial<Session>;
  }

  // No-show resolution is based on scheduled start + grace window.
  if (graceElapsed) {
    // Provider no-show (only terminal outcome that blocks payout).
    if (!providerJoinedAt) {
      if (status === 'provider_no_show') return null;
      const noShowParty: 'provider' | 'both' = studentJoinedAt ? 'provider' : 'both';
      const patch: any = {
        status: 'provider_no_show',
        updatedAt: nowISO,
        markedNoShowAt: nowISO,
        noShowParty,
        providerJoinedAt,
        studentJoinedAt,
        attendanceFlag: 'provider_no_show',
        providerEligibleForPayout: false,
        providerEarned: false,
        flagNoShowProvider: true,
        flagNoShowStudent: noShowParty === 'both',
        providerJoinCount,
        studentJoinCount,
        attendanceCheckedAt: nowISO,
        attendanceSource: hasZoomMeetingId ? 'zoom' : 'missing_zoom_meeting_id',
      };
      return patch as Partial<Session>;
    }
  }

  // Nothing to auto-resolve.
  void endMs;
  return null;
}


