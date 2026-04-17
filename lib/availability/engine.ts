/**
 * Canonical availability and slot engine
 * Pure functions for availability calculations using America/New_York timezone
 */

const DEFAULT_TIME_ZONE = 'America/New_York';

/**
 * Normalize service type to canonical format
 * Returns one of: tutoring, test_prep, college_counseling, virtual_tour
 */
export type CanonicalServiceType = 'tutoring' | 'test_prep' | 'college_counseling' | 'virtual_tour';

export function normalizeServiceType(input: string): CanonicalServiceType {
  if (!input || !String(input).trim()) {
    throw new Error('[availability/engine] serviceType is required');
  }
  
  // Convert to lowercase and replace hyphens with underscores
  let normalized = input.toLowerCase().replace(/-/g, '_');
  
  // Strip plan suffixes (monthly, single, 30min, 60min, etc.)
  normalized = normalized.replace(/_monthly$/, '');
  normalized = normalized.replace(/_single$/, '');
  normalized = normalized.replace(/_30min$/, '');
  normalized = normalized.replace(/_60min$/, '');
  normalized = normalized.replace(/_30_min$/, '');
  normalized = normalized.replace(/_60_min$/, '');
  
  // Map to canonical types
  if (normalized === 'tutoring') return 'tutoring';
  if (normalized === 'test_prep' || normalized === 'testprep') return 'test_prep';
  if (normalized === 'counseling' || normalized === 'college_counseling') return 'college_counseling';
  if (normalized === 'virtual_tour' || normalized === 'virtualtour') return 'virtual_tour';
  
  throw new Error(`[availability/engine] Unrecognized serviceType: ${input}`);
}

/**
 * Safe helper for optional inputs (query params, etc.)
 * - null/undefined/empty => null
 * - otherwise => strict canonical normalization
 */
export function normalizeServiceTypeOrNull(input: string | null | undefined): CanonicalServiceType | null {
  if (!input || !String(input).trim()) return null;
  return normalizeServiceType(input);
}

/**
 * Normalize date to YYYY-MM-DD format in America/New_York timezone
 * @param date - Date object, ISO string, or YYYY-MM-DD string
 * @returns YYYY-MM-DD string in America/New_York timezone
 */
export function normalizeDateKey(date: Date | string): string {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // If it's already YYYY-MM-DD format, parse it carefully
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Parse as date in America/New_York timezone
      const [year, month, day] = date.split('-').map(Number);
      // Create date in America/New_York using Intl API
      const tzDate = new Date(date + 'T12:00:00'); // Use noon to avoid DST issues
      // Convert to America/New_York timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: DEFAULT_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(tzDate);
      const yearStr = parts.find(p => p.type === 'year')?.value || String(year);
      const monthStr = parts.find(p => p.type === 'month')?.value || String(month).padStart(2, '0');
      const dayStr = parts.find(p => p.type === 'day')?.value || String(day).padStart(2, '0');
      return `${yearStr}-${monthStr}-${dayStr}`;
    }
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  // Format date in America/New_York timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(dateObj);
  const year = parts.find(p => p.type === 'year')?.value || '2000';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert time string with AM/PM to minutes since midnight
 * @param timeStr - Time in format "HH:MM AM" or "HH:MM PM" (12-hour format)
 * @returns Minutes 0 to 1439
 */
export function timeToMinutes(timeStr: string): number {
  // Handle both "9:15 PM" and "21:15" formats
  const trimmed = timeStr.trim();
  
  // Check if it's 24-hour format (no AM/PM)
  if (!trimmed.match(/[AP]M/i)) {
    const [hours, minutes] = trimmed.split(':').map(Number);
    return (hours % 24) * 60 + (minutes % 60);
  }
  
  // Parse 12-hour format with AM/PM
  const match = trimmed.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Expected format: "HH:MM AM" or "HH:MM PM"`);
  }
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to display string in America/New_York timezone
 * @param minutes - Minutes 0 to 1439
 * @returns Display string in 12-hour format with AM/PM (e.g., "9:15 PM")
 */
export function minutesToTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
}

/**
 * Alias for timeToMinutes - converts time string to minutes since midnight
 * @param timeStr - Time in format "HH:MM AM" or "HH:MM PM" (12-hour format)
 * @returns Minutes 0 to 1439
 */
export function minutesFromTimeString(timeStr: string): number {
  return timeToMinutes(timeStr);
}

/**
 * Alias for minutesToTime - converts minutes since midnight to display string
 * @param minutes - Minutes 0 to 1439
 * @returns Display string in 12-hour format with AM/PM (e.g., "9:30 PM")
 */
export function timeStringFromMinutes(minutes: number): string {
  return minutesToTime(minutes);
}

/**
 * Time range in minutes
 */
export interface TimeRangeMinutes {
  startMinutes: number;
  endMinutes: number;
}

/**
 * Generate slots for a day based on availability ranges and session duration
 * @param startMinutes - Start of availability range in minutes since midnight
 * @param endMinutes - End of availability range in minutes since midnight
 * @param durationMinutes - Duration of the session in minutes
 * @returns Sorted list of start minute values where start + duration fits inside a range
 */
export function generateSlots(
  startMinutes: number,
  endMinutes: number,
  durationMinutes: number
): number[] {
  const slots: number[] = [];
  
  // Handle ranges that don't cross midnight
  if (startMinutes <= endMinutes) {
    // Generate slots starting at startMinutes, incrementing by durationMinutes
    // until start + duration would exceed endMinutes
    let currentStart = startMinutes;
    while (currentStart + durationMinutes <= endMinutes) {
      slots.push(currentStart);
      currentStart += durationMinutes;
    }
  } else {
    // Range crosses midnight (e.g., 22:00 - 02:00)
    // Generate slots in two parts: from startMinutes to 1440, and from 0 to endMinutes
    let currentStart = startMinutes;
    while (currentStart + durationMinutes <= 1440) {
      slots.push(currentStart);
      currentStart += durationMinutes;
    }
    
    currentStart = 0;
    while (currentStart + durationMinutes <= endMinutes) {
      slots.push(currentStart);
      currentStart += durationMinutes;
    }
  }
  
  // Sort and deduplicate
  return Array.from(new Set(slots)).sort((a, b) => a - b);
}

/**
 * Generate slots for a day based on availability ranges and session duration
 * @param availabilityRanges - Array of time ranges in minutes
 * @param sessionDurationMinutes - Duration of the session in minutes
 * @returns Sorted list of start minute values where start + duration fits inside a range
 */
export function generateSlotsForDay(
  availabilityRanges: TimeRangeMinutes[],
  sessionDurationMinutes: number
): number[] {
  const allSlots: number[] = [];
  
  for (const range of availabilityRanges) {
    const { startMinutes, endMinutes } = range;
    const rangeSlots = generateSlots(startMinutes, endMinutes, sessionDurationMinutes);
    allSlots.push(...rangeSlots);
  }
  
  // Sort and deduplicate
  return Array.from(new Set(allSlots)).sort((a, b) => a - b);
}

/**
 * Compute timezone offset (in minutes) for a given UTC Date in a target IANA timezone.
 * The returned value matches the sign of Date#getTimezoneOffset (e.g. New York in winter => +300).
 */
function getTimeZoneOffsetMinutes(utcDate: Date, tz: string): number {
  const safeTz = typeof tz === 'string' && tz.trim() ? tz.trim() : DEFAULT_TIME_ZONE;
  // Format the UTC instant in the target timezone, then interpret the formatted parts as a UTC timestamp.
  // The delta between that "as-if-UTC" timestamp and the real UTC instant yields the timezone offset.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (utcDate.getTime() - asUTC) / 60000;
}

/**
 * Bind a YYYY-MM-DD date key and a provider-local "minutes since midnight" time into a real UTC Date.
 * Treats the minutes as local to `timeZone` and converts exactly once to UTC (no double conversion).
 */
export function bindDateKeyAndMinutesToUtcDate(
  dateKey: string,
  minutesSinceMidnight: number,
  timeZone: string = DEFAULT_TIME_ZONE
): Date {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : DEFAULT_TIME_ZONE;
  const [year, month, day] = dateKey.split('-').map(Number);
  const hh = Math.floor(minutesSinceMidnight / 60);
  const mm = minutesSinceMidnight % 60;
  const localAsIfUTC = Date.UTC(year, month - 1, day, hh, mm, 0);

  // Iterate to stabilize across DST boundaries (usually converges in 1-2 passes).
  let guessMs = localAsIfUTC;
  for (let i = 0; i < 3; i++) {
    const guessDate = new Date(guessMs);
    const offsetMinutes = getTimeZoneOffsetMinutes(guessDate, tz);
    const correctedMs = localAsIfUTC + offsetMinutes * 60_000;
    if (correctedMs === guessMs) break;
    guessMs = correctedMs;
  }
  return new Date(guessMs);
}

/**
 * Generate slots for availability blocks with configurable interval and duration
 * This is the main function for generating all available time slots within availability windows.
 * 
 * @param blocks - Array of availability blocks with startMinutes and endMinutes
 * @param date - Date string in YYYY-MM-DD format (for logging/debugging)
 * @param opts - Options for slot generation
 * @param opts.slotIntervalMinutes - Interval between slot start times (default: 60)
 * @param opts.sessionDurationMinutes - Duration of each session (default: 60)
 * @param opts.roundToInterval - Whether to round start times to nearest interval (default: true)
 * @returns Array of ISO timestamp strings for slot start times
 */
export function generateSlotsForBlocks(
  blocks: Array<{ startMinutes: number; endMinutes: number }>,
  date: string,
  opts: {
    slotIntervalMinutes?: number;
    sessionDurationMinutes?: number;
    roundToInterval?: boolean;
    timeZone?: string; // IANA timezone, default America/New_York
  } = {}
): string[] {
  const slotIntervalMinutes = opts.slotIntervalMinutes ?? 60;
  const sessionDurationMinutes = opts.sessionDurationMinutes ?? 60;
  const roundToInterval = opts.roundToInterval ?? true;
  const timeZoneRaw = typeof opts.timeZone === 'string' ? opts.timeZone.trim() : '';
  const timeZone = timeZoneRaw || DEFAULT_TIME_ZONE;
  
  const slots: string[] = [];
  
  // Parse date to get year, month, day
  // (date is already a YYYY-MM-DD key; we bind minutes to this date key per slot)
  
  for (const block of blocks) {
    const { startMinutes, endMinutes } = block;
    
    // Calculate the first valid slot start time
    let currentStart = startMinutes;
    
    // Round to nearest interval if enabled
    if (roundToInterval) {
      currentStart = Math.ceil(currentStart / slotIntervalMinutes) * slotIntervalMinutes;
    }
    
    // Generate slots: start + duration must fit within block
    while (currentStart + sessionDurationMinutes <= endMinutes) {
      // Convert minutes to ISO timestamp by binding date + local time in provider timezone, then converting once to UTC.
      const hours24 = Math.floor(currentStart / 60);
      const mins = currentStart % 60;
      
      // Slot generation MUST bind requested date + availability time into full Date objects.
      // We treat stored minutes as provider-local time, and convert once to UTC.
      const startUtcDate = bindDateKeyAndMinutesToUtcDate(
        date,
        hours24 * 60 + mins,
        timeZone
      );
      const startTimeISO = startUtcDate.toISOString();
      
      slots.push(startTimeISO);
      
      // Move to next interval
      currentStart += slotIntervalMinutes;
    }
  }
  
  // Sort and deduplicate
  return Array.from(new Set(slots)).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

const WEEKDAY_NAME_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : DEFAULT_TIME_ZONE;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`[availability/engine] Invalid dateKey: ${dateKey}`);
  }
  const dt = new Date(Date.UTC(year, month - 1, day + Number(days || 0), 12, 0, 0));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekdayIndexForDateKey(dateKey: string, timeZone: string): number {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : DEFAULT_TIME_ZONE;
  // Use local noon to avoid DST edge cases while still computing the correct local calendar weekday.
  const noonUtc = bindDateKeyAndMinutesToUtcDate(dateKey, 12 * 60, tz);
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
  }).format(noonUtc);
  const idx = WEEKDAY_NAME_TO_INDEX[weekdayName];
  return Number.isFinite(idx) ? idx : 0;
}

/**
 * Find the next occurrence (inclusive) of a weekday in a provider's local calendar.
 * - anchorDateKey is interpreted as a local calendar date in `timeZone`.
 * - desiredDayOfWeek uses JS convention: 0=Sunday ... 6=Saturday
 */
export function getNextWeekdayDateKeyInTimeZone(
  anchorDateKey: string,
  desiredDayOfWeek: number,
  timeZone: string
): string {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : DEFAULT_TIME_ZONE;
  const desired = Number(desiredDayOfWeek);
  if (!Number.isFinite(desired) || desired < 0 || desired > 6) {
    throw new Error(`[availability/engine] Invalid desiredDayOfWeek: ${desiredDayOfWeek}`);
  }
  const anchorDow = getWeekdayIndexForDateKey(anchorDateKey, tz);
  const delta = (desired - anchorDow + 7) % 7;
  return addDaysToDateKey(anchorDateKey, delta);
}

/**
 * Check if a session window fits inside an availability range
 * Uses inclusive start and inclusive end logic
 * @param startMin - Session start time in minutes since midnight
 * @param durationMin - Session duration in minutes
 * @param range - Availability range in minutes
 * @returns true if the entire session window fits within the range
 */
export function isSessionWindowInsideRange(
  startMin: number,
  durationMin: number,
  range: TimeRangeMinutes
): boolean {
  const sessionEndMin = startMin + durationMin;
  const { startMinutes, endMinutes } = range;
  
  // Handle normal ranges (don't cross midnight)
  if (startMinutes <= endMinutes) {
    // Session must start at or after range start, and end at or before range end
    return startMin >= startMinutes && sessionEndMin <= endMinutes;
  } else {
    // Range crosses midnight
    // Session must be entirely before midnight OR entirely after midnight
    if (startMin >= startMinutes && sessionEndMin <= 1440) {
      // Session is entirely in the "before midnight" portion
      return true;
    }
    if (startMin >= 0 && sessionEndMin <= endMinutes) {
      // Session is entirely in the "after midnight" portion
      return true;
    }
    return false;
  }
}

