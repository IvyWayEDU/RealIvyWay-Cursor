'use server';

import { readAvailabilityFile, readReservedSlotsFile } from './store.server';
import { bindDateKeyAndMinutesToUtcDate, generateSlotsForBlocks, normalizeServiceType } from './engine';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';

export interface TimeSlot {
  start: string; // ISO 8601 UTC timestamp
  end: string; // ISO 8601 UTC timestamp
  providerId: string;
}

/**
 * Generate available slots for a given date in user timezone
 * Filters by service type and subject/school
 * Applies 2-hour lead time buffer for virtual tours only
 */
export async function generateSlots(
  date: string, // YYYY-MM-DD format
  userTimezone: string = 'America/New_York',
  serviceType: string,
  subject?: string,
  school?: string
): Promise<TimeSlot[]> {
  // NOTE: userTimezone/subject/school filtering is handled by the newer /all-slots API.
  // This helper focuses on generating slots from canonical availability storage and
  // excluding both booked sessions and RESERVED slots.

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const normalizedService = normalizeServiceType(serviceType);
  const availabilityServiceType =
    normalizedService === 'virtual_tour'
      ? 'college_counseling'
      : normalizedService === 'test_prep'
        ? 'tutoring'
        : normalizedService;
  // College counseling is 60 minutes only (no 30-minute counseling sessions).
  // Virtual tours also use 60 minutes.
  const durationMinutes = 60;

  // Calculate lead time buffer (2 hours for virtual tours, 0 otherwise)
  const leadTimeHours = normalizedService === 'virtual_tour' ? 2 : 0;
  const minStartMs = Date.now() + leadTimeHours * 60 * 60 * 1000;

  const availabilityStorage = await readAvailabilityFile();

  const reserved = await readReservedSlotsFile();
  const reservedSet = new Set(
    reserved
      .filter((s) => (s.status ?? 'available') === 'reserved')
      .map((s) => `${s.providerId}|${s.startTime}|${s.endTime}`)
  );

  // Determine dayOfWeek in America/New_York timezone (same strategy as /all-slots route)
  const tzDate = new Date(date + 'T12:00:00'); // noon to avoid DST issues
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
  });
  const dayName = formatter.format(tzDate);
  const dayOfWeekMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const dayOfWeek = dayOfWeekMap[dayName] ?? 0;

  // Fetch booked sessions from Supabase `sessions` table (canonical fields).
  const providerIdsForSessionQuery = Array.from(
    new Set(
      Object.values(availabilityStorage)
        .map((e: any) => (typeof e?.providerId === 'string' ? String(e.providerId).trim() : ''))
        .filter(Boolean)
    )
  );

  const requestedDayStartUTC = bindDateKeyAndMinutesToUtcDate(date, 0, 'America/New_York');
  const requestedDayEndUTC = new Date(requestedDayStartUTC.getTime() + 24 * 60 * 60 * 1000);
  const sessionQueryStartISO = new Date(requestedDayStartUTC.getTime() - 60 * 60 * 1000).toISOString();
  const sessionQueryEndISO = new Date(requestedDayEndUTC.getTime() + 60 * 60 * 1000).toISOString();

  const bookedWindows = await getBookedSessionWindowsForProviders({
    providerIds: providerIdsForSessionQuery,
    rangeStartISO: sessionQueryStartISO,
    rangeEndISO: sessionQueryEndISO,
    defaultDurationMinutesWhenMissingEnd: 60,
  });

  const bookedWindowsByProvider = new Map<string, Array<{ sessionStartMs: number; sessionEndMs: number }>>();
  for (const w of bookedWindows) {
    const arr = bookedWindowsByProvider.get(w.providerId) || [];
    arr.push({ sessionStartMs: w.sessionStartMs, sessionEndMs: w.sessionEndMs });
    bookedWindowsByProvider.set(w.providerId, arr);
  }

  const slotOverlapsBookedSession = (providerId: string, slotStartISO: string, durationMinutes: number): boolean => {
    const slotStartMs = new Date(slotStartISO).getTime();
    if (!Number.isFinite(slotStartMs)) return false;
    const slotEndMs = slotStartMs + Math.max(1, durationMinutes) * 60 * 1000;
    const windows = bookedWindowsByProvider.get(providerId) || [];
    for (const s of windows) {
      if (slotStartMs < s.sessionEndMs && slotEndMs > s.sessionStartMs) return true;
    }
    return false;
  };

  const slots: TimeSlot[] = [];

  for (const entry of Object.values(availabilityStorage)) {
    const providerId = (entry as any)?.providerId;
    if (!providerId) continue;

    // Strict: availability rows must match requested serviceType (after normalization/mapping).
    if (availabilityServiceType) {
      const entryServiceType = String((entry as any).serviceType || '');
      if (entryServiceType !== availabilityServiceType) continue;
    }

    const blocksForDay = (entry.blocks || []).filter((b) => b.dayOfWeek === dayOfWeek);
    if (blocksForDay.length === 0) continue;

    const startISOs = generateSlotsForBlocks(blocksForDay, date, {
      slotIntervalMinutes: 60,
      sessionDurationMinutes: durationMinutes,
      roundToInterval: true,
      timeZone: (entry as any)?.timezone || 'America/New_York',
    });

    for (const startTimeISO of startISOs) {
      const startMs = new Date(startTimeISO).getTime();
      if (!Number.isFinite(startMs)) continue;
      if (startMs < minStartMs) continue;

      const endTimeISO = new Date(startMs + durationMinutes * 60 * 1000).toISOString();

      const reservationKey = `${providerId}|${startTimeISO}|${endTimeISO}`;
      if (reservedSet.has(reservationKey)) continue;

      if (slotOverlapsBookedSession(providerId, startTimeISO, durationMinutes)) continue;

      slots.push({
        providerId,
        start: startTimeISO,
        end: endTimeISO,
      });
    }
  }

  return slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

