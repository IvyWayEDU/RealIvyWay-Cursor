import 'server-only';

import type { Session } from './types';
import { getAuthContext } from './session';

/**
 * getServerSession()
 *
 * IvyWay's Next.js route handlers use a custom cookie session.
 * This helper matches the common "getServerSession" usage pattern:
 * - returns a Session when authenticated
 * - returns null otherwise
 */
export async function getServerSession(): Promise<Session | null> {
  const ctx = await getAuthContext();
  if (ctx.status !== 'ok') return null;
  return ctx.session;
}

