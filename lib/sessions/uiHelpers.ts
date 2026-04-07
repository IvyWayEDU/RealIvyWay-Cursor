'use client';

import { Session } from '@/lib/models/types';

/**
 * Parse an ISO-ish timestamp into a UTC-safe epoch ms value.
 *
 * Why: some legacy/session records may carry timestamps without a timezone suffix
 * (e.g. "2026-01-23T17:00:00"), which JS interprets as *local time*.
 * For join gating we must treat `session.startTime` as UTC-safe.
 */
export function parseUtcEpochMs(isoLike?: unknown): number | null {
  if (typeof isoLike !== 'string') return null;
  const s = isoLike.trim();
  if (!s) return null;

  // Only append "Z" when it's a full datetime with no timezone info.
  const hasT = s.includes('T');
  const hasTzSuffix = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
  const normalized = hasT && !hasTzSuffix ? `${s}Z` : s;

  const t = new Date(normalized).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Canonical session start time in epoch ms.
 * Per spec, prefer `session.startTimeISO` or fall back to `session.startTime`,
 * and convert using `new Date(value).getTime()`.
 */
export function getSessionStartTimeMs(session: Session & { [key: string]: any }): number | null {
  const v = (session as any)?.startTimeISO ?? (session as any)?.startTime;
  if (typeof v !== 'string') return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Canonical (Supabase) session start time in epoch ms.
 * Source of truth: `session.datetime` (NOT legacy `startTime`).
 */
export function getSessionDatetimeMs(session: Session & { [key: string]: any }): number | null {
  return parseUtcEpochMs((session as any)?.datetime);
}

/**
 * Canonical (Supabase) session end time in epoch ms.
 * Source of truth: `session.end_datetime`.
 *
 * If `end_datetime` is null/missing, assume a 60 minute duration.
 */
export function getSessionEndDatetimeMs(session: Session & { [key: string]: any }): number | null {
  const explicitEnd = parseUtcEpochMs((session as any)?.end_datetime);
  if (explicitEnd !== null) return explicitEnd;

  const startMs = getSessionDatetimeMs(session);
  if (startMs === null) return null;
  return startMs + 60 * 60 * 1000;
}

/**
 * Join button timing logic:
 * - Enabled starting exactly 10 minutes before `session.datetime`
 * - Stays enabled through the session end time (inclusive)
 */
export function canJoinSessionNow(session: Session & { [key: string]: any }, nowMs: number): boolean {
  const startMs = getSessionDatetimeMs(session);
  if (startMs === null) return false;

  const endMs = getSessionEndDatetimeMs(session);
  if (endMs === null) return false;

  const openMs = startMs - 10 * 60 * 1000;
  return nowMs >= openMs && nowMs <= endMs;
}

/**
 * Normalize Zoom join URL from session object.
 * Checks multiple possible fields to find a Zoom join URL.
 * 
 * @param session - The session object
 * @returns The normalized Zoom join URL, or undefined if none found
 */
export function normalizeZoomJoinUrl(session: Session & { [key: string]: any }): string | undefined {
  // Check in order of preference:
  // 1. zoom_join_url (snake_case; stored in Supabase `sessions.data` and/or in a dedicated column)
  // 2. joinUrl (alternative field name)
  // 3. zoom_url (alternative field name)
  // 4. meeting?.join_url (nested object)
  
  if ((session as any).zoom_join_url) {
    return (session as any).zoom_join_url;
  }
  
  if (session.joinUrl) {
    return session.joinUrl;
  }
  
  if (session.zoom_url) {
    return session.zoom_url;
  }
  
  if (session.meeting?.join_url) {
    return session.meeting.join_url;
  }
  
  return undefined;
}

/**
 * Check if session is within the valid join window
 * Session is valid if: now <= startTime + 10 minutes
 */
export function isWithinValidJoinWindow(session: Session): boolean {
  if (!session.scheduledStartTime) return false;
  const startTime = new Date(session.scheduledStartTime);
  const expirationTime = new Date(startTime.getTime() + 10 * 60 * 1000); // 10 minutes after start
  const now = new Date();
  return now <= expirationTime;
}

/**
 * Shared utility function to determine if Join Session button should be shown.
 * 
 * Rule: Show Join Session button IF:
 * - session.status === "upcoming" OR "in_progress" (paid + active session)
 * - Session is not expired (not past end time + 10 minutes)
 * - Ignore legacy test sessions missing Zoom data (only enforce on sessions with Zoom data)
 * 
 * Note: 
 * - Button is ALWAYS shown for upcoming and in_progress sessions (never hidden conditionally)
 * - Button state (enabled/disabled) is determined by time, not visibility
 * - Button disappears only after session end + 10 minutes
 */
export function shouldShowJoinSessionButton(session: Session & { [key: string]: any }): boolean {
  // Must have status "upcoming" or "in_progress" (indicates payment has been made and session is active)
  if (session.status !== 'upcoming' && session.status !== 'in_progress') {
    return false;
  }

  // Check if session has expired (past end time + 10 minutes)
  if (isSessionExpiredAfterEnd(session)) {
    return false;
  }

  // For sessions created after this fix, require Zoom URL
  // For legacy sessions, show button if they have Zoom data
  const joinUrl = normalizeZoomJoinUrl(session);
  if (!joinUrl && !session.zoomMeetingId) {
    // Legacy test session without Zoom data - ignore
    return false;
  }

  return true;
}

/**
 * Check if current time is before session start time.
 * Used to determine if we should show a "too early" message.
 */
export function isBeforeSessionStart(session: Session): boolean {
  if (!session.scheduledStartTime) return false;
  const startTime = new Date(session.scheduledStartTime);
  const now = new Date();
  return now < startTime;
}

/**
 * Check if join window is open (start time to start time + 10 minutes).
 * This is used when clicking the button to determine if joining is allowed.
 * 
 * Rule:
 * - Join window opens at session start time
 * - Join window closes 10 minutes after session start time
 * - Both student and provider have a 10-minute window to join after start
 */
export function isJoinWindowOpen(session: Session): boolean {
  if (!session.scheduledStartTime) {
    return false;
  }
  
  const startTime = new Date(session.scheduledStartTime);
  const now = new Date();
  const tenMinutesAfterStart = new Date(startTime.getTime() + 10 * 60 * 1000);
  
  // Join window is from start time to start time + 10 minutes
  return now >= startTime && now <= tenMinutesAfterStart;
}

/**
 * Check if button should be disabled (before session start time).
 * Note: Join button is always visible for upcoming paid sessions.
 * Clicking before start time shows a message instead of joining.
 * 
 * @deprecated This function is not currently used. Join button always shows
 * and handles timing in click handler instead.
 */
export function isJoinButtonDisabled(session: Session): boolean {
  if (!session.scheduledStartTime) {
    return true;
  }
  
  const startTime = new Date(session.scheduledStartTime);
  const now = new Date();
  
  // Button is disabled if before start time (click handler will show message)
  return now < startTime;
}

/**
 * Check if session has expired due to provider no-show
 * Session is expired if: now > startTime + 10 minutes AND providerJoinedAt is null
 */
export function isSessionExpired(session: Session): boolean {
  if (session.status === 'expired_provider_no_show') {
    return true;
  }
  
  // Also check runtime expiration for upcoming sessions
  if (session.status === 'upcoming' && !session.providerJoinedAt) {
    if (!session.scheduledStartTime) return false;
    const startTime = new Date(session.scheduledStartTime);
    const expirationTime = new Date(startTime.getTime() + 10 * 60 * 1000); // 10 minutes after start
    const now = new Date();
    return now > expirationTime;
  }
  
  return false;
}

/**
 * Check if session has expired after end time (end + 10 minutes).
 * Used to determine when Join button should disappear.
 */
export function isSessionExpiredAfterEnd(session: Session): boolean {
  // Check status first
  if (session.status === 'expired_provider_no_show') {
    return true;
  }
  
  if (!session.scheduledEndTime) {
    return false;
  }
  
  const endTime = new Date(session.scheduledEndTime);
  const expirationTime = new Date(endTime.getTime() + 10 * 60 * 1000); // 10 minutes after end
  const now = new Date();
  
  return now > expirationTime;
}

