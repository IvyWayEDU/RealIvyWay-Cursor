'use server';

import { Session } from '@/lib/models/types';
import { getSessions, updateSession, getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';

/**
 * Earnings are derived dynamically from completed sessions.
 * This legacy resolver no longer creates/updates any earnings records.
 */
async function creditProviderEarnings(_session: Session): Promise<boolean> {
  return false;
}

/**
 * DEPRECATED: Use resolveUnifiedSessions from unified-resolver.ts instead.
 * 
 * This resolver is disabled in favor of the unified resolver which handles
 * ALL service types identically using scheduledEnd time as the sole completion condition.
 * 
 * This function now delegates to the unified resolver.
 */
export async function resolveSessions(): Promise<void> {
  // Delegate to unified resolver
  const { resolveUnifiedSessions } = await import('@/lib/sessions/unified-resolver');
  await resolveUnifiedSessions('api_fetch');
  return;
  // This function now delegates to the unified resolver
  // All completion logic has been moved to unified-resolver.ts
}

/**
 * DEPRECATED: Use resolveUnifiedSessions from unified-resolver.ts instead.
 * 
 * This resolver is disabled in favor of the unified resolver which handles
 * ALL service types identically using scheduledEnd time as the sole completion condition.
 * 
 * This function now delegates to the unified resolver.
 */
export async function resolveCompletableSessions(triggerSource: 'dashboard_fetch' | 'session_fetch' | 'api_fetch' | 'provider_leave' | 'provider_join' = 'api_fetch'): Promise<void> {
  // Delegate to unified resolver
  const { resolveUnifiedSessions } = await import('@/lib/sessions/unified-resolver');
  await resolveUnifiedSessions(triggerSource === 'provider_join' ? 'provider_join' : 'api_fetch');
  return;
  // This function now delegates to the unified resolver
  // All completion logic has been moved to unified-resolver.ts
}

/**
 * DEPRECATED: Use resolveUnifiedSessions from unified-resolver.ts instead.
 * 
 * This function is disabled in favor of the unified resolver which handles
 * ALL service types identically using scheduledEnd time as the sole completion condition.
 * 
 * This function now delegates to the unified resolver.
 */
export async function resolveSessionAfterHeartbeat(sessionId: string): Promise<void> {
  // Delegate to unified resolver
  const { resolveUnifiedSessions } = await import('@/lib/sessions/unified-resolver');
  await resolveUnifiedSessions('api_fetch');
}

