import { getSessions, saveSessions } from './storage';
import {
  readReservedSlotsFile,
  writeReservedSlotsFile,
} from '@/lib/availability/store.server';

export async function clearUpcomingSessionsForDev(): Promise<number> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEV reset blocked in production');
  }

  // In development mode, delete ALL sessions unconditionally.
  // Also clear availability bookings (restore consumed blocks + clear reserved slots).
  const sessions = await getSessions();
  const sessionCount = sessions.length;

  // 1) Clear reserved slots (booking integrity source-of-truth).
  try {
    const existing = await readReservedSlotsFile();
    if (existing.length > 0) {
      await writeReservedSlotsFile([]);
    }
  } catch (error) {
    console.error('[DEV RESET] Failed clearing reserved slots file:', error);
  }

  // 2) Delete all sessions by saving an empty array
  await saveSessions([]);

  console.log('[DEV RESET] DEV-ONLY: Cleared', sessionCount, 'sessions and reserved slots');
  return sessionCount;
}

