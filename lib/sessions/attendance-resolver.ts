'use server';

import { Session } from '@/lib/models/types';
import { getSessions, updateSession, getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';

/**
 * DEPRECATED: Use resolveUnifiedSessions from unified-resolver.ts instead.
 * 
 * This resolver is disabled in favor of the unified resolver which handles
 * ALL service types identically using provider join within 10 minutes as the sole completion condition.
 * 
 * This function now delegates to the unified resolver.
 * 
 * @param triggerSource - Source of the call for logging purposes
 */
export async function resolveSessionsThatCanBeResolved(triggerSource: string = 'unknown'): Promise<void> {
  // Delegate to unified resolver
  const { resolveUnifiedSessions } = await import('@/lib/sessions/unified-resolver');
  await resolveUnifiedSessions('api_fetch');
  return;
  // This function now delegates to the unified resolver
  // All completion logic has been moved to unified-resolver.ts
}

