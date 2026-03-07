'use server';

import { getSessions } from '@/lib/sessions/storage';

/**
 * UNIFIED SESSION LIFECYCLE RESOLVER (CANONICAL)
 *
 * This is the SINGLE SOURCE OF TRUTH for session completion.
 * ALL service types are handled identically.
 *
 * CANONICAL RULES (AUTHORITATIVE):
 * - Sessions only store: confirmed | completed | cancelled
 * - A session becomes `completed` when:
 *   currentTimeUTC >= session.scheduledEnd
 *
 * TRIGGERING:
 * - Resolver runs on fetches (API/server) and is idempotent.
 */

// Note: status transitions are time-based and handled during `getSessions()` reads.

/**
 * Unified session lifecycle resolver
 * 
 * This is the ONLY place where sessions can move to `completed` automatically.
 * 
 * @param triggerSource - Source of the call for logging purposes
 */
export async function resolveUnifiedSessions(
  triggerSource: 'dashboard_fetch' | 'earnings_fetch' | 'sessions_fetch' | 'api_fetch' | 'provider_join' | 'webhook' | 'dev_resolve' = 'api_fetch'
): Promise<void> {
  const logPrefix = triggerSource === 'dev_resolve' ? '[DEV_RESOLVE]' : '[RESOLVER]';
  console.log(`${logPrefix} Started`, { triggerSource });
  
  try {
    // `getSessions()` is authoritative for normalization + time-based completion.
    // Calling it here ensures API endpoints that already invoke the resolver keep working.
    await getSessions();
    
    console.log(`${logPrefix} Finished`, { triggerSource });
  } catch (error) {
    console.error(`${logPrefix} Error in resolveUnifiedSessions:`, error);
    // Don't throw - resolver should fail gracefully
  }
}
/**
 * Track provider join (called from webhook or UI).
 *
 * NOTE: Attendance is no longer used for status transitions. This is preserved
 * for analytics/audit only.
 */
export async function trackProviderJoinUnified(_sessionId: string, _joinTime?: Date): Promise<{
  success: boolean;
  error?: string;
  joinedWithinWindow?: boolean;
}> {
  try {
    const { getSessionById, updateSession } = await import('@/lib/sessions/storage');

    const sessionId = String(_sessionId || '').trim();
    if (!sessionId) return { success: false, error: 'Missing sessionId' };

    const existing = await getSessionById(sessionId);
    if (!existing) return { success: false, error: 'Session not found' };

    // Idempotent: only set providerJoinedAt the first time.
    if ((existing as any)?.providerJoinedAt) {
      return { success: true };
    }

    const joinTime = _joinTime instanceof Date ? _joinTime : new Date();
    const nowISO = joinTime.toISOString();

    // Best-effort grace window (10 minutes after scheduled start), for logging/analytics only.
    let joinedWithinWindow: boolean | undefined = undefined;
    const scheduledStartIso =
      (existing as any)?.scheduledStartTime || (existing as any)?.scheduledStart || (existing as any)?.startTime;
    const startMs = scheduledStartIso ? new Date(scheduledStartIso).getTime() : NaN;
    if (Number.isFinite(startMs)) {
      joinedWithinWindow = joinTime.getTime() <= startMs + 10 * 60 * 1000;
    }

    const prevLogs: any[] = Array.isArray((existing as any)?.zoomJoinLogs) ? (existing as any).zoomJoinLogs : [];
    const nextLogs = [
      ...prevLogs,
      { role: 'provider', joinedAt: nowISO, source: _joinTime ? 'zoom_webhook' : 'ui_click' },
    ];
    await updateSession(sessionId, { providerJoinedAt: nowISO, zoomJoinLogs: nextLogs, updatedAt: nowISO } as any);
    return { success: true, joinedWithinWindow };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to track provider join' };
  }
}
