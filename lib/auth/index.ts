import { getSession } from './session';
import { getUserById } from './storage';

/**
 * Convenience helper for API routes: fetch the full current user record (or null).
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return await getUserById(session.userId);
}

export * from './types';


