import type { ProviderAvailability } from './storage';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import type { Session } from '@/lib/models/types';

/**
 * Normalize service type to snake_case format
 * All service types must use snake_case internally:
 * - tutoring → tutoring
 * - tutoring-monthly → tutoring
 * - tutoring-single → tutoring
 * - test-prep → test_prep
 * - test-prep-monthly → test_prep
 * - test-prep-single → test_prep
 * - counseling → counseling
 * - college-counseling → college_counseling
 * - virtual-tour → virtual_tour
 * - virtual_tour → virtual_tour
 * 
 * Rules:
 * - Lowercase
 * - Replace hyphens with underscores
 * - Strip plan suffixes (monthly, single, etc.)
 */
export function normalizeServiceType(serviceType: string | null | undefined): string {
  if (!serviceType || !String(serviceType).trim()) {
    throw new Error('[availability/utils] serviceType is required');
  }
  
  // Convert to lowercase and replace hyphens with underscores
  let normalized = serviceType.toLowerCase().replace(/-/g, '_');
  
  // Strip plan suffixes (monthly, single, 30min, 60min, etc.)
  // Match common plan suffixes at the end of the string
  normalized = normalized.replace(/_monthly$/, '');
  normalized = normalized.replace(/_single$/, '');
  normalized = normalized.replace(/_30min$/, '');
  normalized = normalized.replace(/_60min$/, '');
  normalized = normalized.replace(/_30_min$/, '');
  normalized = normalized.replace(/_60_min$/, '');
  
  // NOTE: This helper is legacy; callers should prefer `lib/availability/engine.ts`.
  // Still, do not silently coerce to a default.
  if (!normalized) {
    throw new Error('[availability/utils] serviceType normalized to empty string');
  }
  return normalized;
}

/**
 * Get existing bookings for a provider on a specific date
 * Returns bookings that overlap with the date (in UTC)
 */
export async function getExistingBookingsForDate(
  providerId: string,
  dateUTC: Date
): Promise<Session[]> {
  const sessions = await getSessionsByProviderId(providerId);
  const dateStart = new Date(dateUTC);
  dateStart.setUTCHours(0, 0, 0, 0);
  const dateEnd = new Date(dateStart);
  dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

  // Filter sessions that:
  // 1. Are upcoming (active bookings)
  // 2. Overlap with the target date
  return sessions.filter(session => {
    // Only consider active bookings
    if (session.status !== 'upcoming' && session.status !== 'paid') {
      return false;
    }

    const sessionStart = new Date(session.scheduledStartTime);
    const sessionEnd = new Date(session.scheduledEndTime);

    // Check if session overlaps with the target date (all times in UTC)
    return sessionStart < dateEnd && sessionEnd > dateStart;
  });
}

/**
 * Subtract booked time ranges from an availability range
 * Returns an array of remaining available time ranges
 */
export function subtractBookingsFromAvailability(
  availabilityStart: Date,
  availabilityEnd: Date,
  bookings: Session[]
): { start: Date; end: Date }[] {
  // Sort bookings by start time
  const sortedBookings = [...bookings].sort((a, b) => {
    return new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime();
  });

  const availableRanges: { start: Date; end: Date }[] = [];
  let currentStart = new Date(availabilityStart);

  for (const booking of sortedBookings) {
    const bookingStart = new Date(booking.scheduledStartTime);
    const bookingEnd = new Date(booking.scheduledEndTime);

    // If booking starts after current availability, we have a gap
    if (bookingStart > currentStart) {
      // Add available range before this booking
      availableRanges.push({
        start: new Date(currentStart),
        end: new Date(bookingStart),
      });
    }

    // Update current start to after this booking
    if (bookingEnd > currentStart) {
      currentStart = new Date(bookingEnd);
    }
  }

  // Add remaining availability after last booking
  if (currentStart < availabilityEnd) {
    availableRanges.push({
      start: new Date(currentStart),
      end: new Date(availabilityEnd),
    });
  }

  return availableRanges;
}

/**
 * Convert UTC timestamp to local time minutes for a given timezone
 * This is used to compare UTC booking timestamps with availability stored as local time minutes
 */
function utcTimestampToLocalMinutes(utcTimestamp: string, timezone: string): number {
  const date = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  return hour * 60 + minute;
}

/**
 * Convert UTC timestamp to a local Date object representation in the specified timezone
 * This creates a Date object with local time components (year, month, day, hour, minute)
 * Note: The Date object will be in system timezone, but we only use it to get day of week
 * 
 * @param utcTimestamp - ISO 8601 UTC timestamp string
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date object representing the local time (used for getDay() calculation)
 */
function utcTimestampToLocalDate(utcTimestamp: string, timezone: string): Date {
  const utcDate = new Date(utcTimestamp);
  
  // Use Intl.DateTimeFormat to get local date components in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(utcDate);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // Create a Date object with local time components
  // This Date will be in system timezone, but we only use it for getDay()
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Get day of week (0-6, where 0 = Sunday) for a UTC timestamp in a specific timezone
 * This is used to match availability days which are stored in local time
 * Uses getDay() on a local Date object, not getUTCDay()
 */
function utcTimestampToLocalDayOfWeek(utcTimestamp: string, timezone: string): number {
  const localDate = utcTimestampToLocalDate(utcTimestamp, timezone);
  return localDate.getDay();
}

/**
 * Check if a selected UTC time slot (with duration) fits within a provider's availability range
 * Provider availability ranges are stored as minutes since midnight (local time)
 * 
 * NOTE: This function requires timezone to convert UTC timestamps to local time for comparison.
 * Timezone should be obtained from user profile or booking context.
 * 
 * @param selectedSlotStartUTC - ISO 8601 UTC timestamp string for slot start
 * @param selectedSlotEndUTC - ISO 8601 UTC timestamp string for slot end
 * @param availability - Provider availability configuration (times stored as minutes)
 * @param timezone - IANA timezone string (e.g., "America/New_York") - provider's timezone
 * @returns true if the entire slot fits within any availability range for that day
 */
export function isSlotWithinAvailability(
  selectedSlotStartUTC: string,
  selectedSlotEndUTC: string,
  availability: ProviderAvailability,
  timezone: string = 'America/New_York' // Default to America/New_York for provider local time
): boolean {
  // Defensive check: if availability.days is undefined or malformed, return false gracefully
  if (!availability || !Array.isArray(availability.days) || availability.days.length !== 7) {
    console.error('[isSlotWithinAvailability] Invalid availability.days structure');
    return false;
  }

  // Convert selectedStartUTC to local Date object in the provider's timezone
  // Example: "2025-12-26T21:00:00.000Z" with timezone "America/New_York" 
  // should represent Dec 26, 4:00 PM local (16:00)
  const localStartDate = utcTimestampToLocalDate(selectedSlotStartUTC, timezone);
  
  // Compute weekday from the LOCAL date using getDay() (NOT getUTCDay())
  // getDay() returns 0 (Sunday) through 6 (Saturday) based on local time
  const dayOfWeek = localStartDate.getDay();
  
  // Defensive guard: if safeDays[dayOfWeek] is undefined, return false gracefully
  const dayAvailability = availability.days[dayOfWeek];
  if (!dayAvailability || !dayAvailability.enabled) {
    console.error('[isSlotWithinAvailability] Selected time is outside provider availability - day not enabled');
    return false;
  }

  // Convert UTC timestamps to local time minutes for comparison
  // timeRanges are already stored as local time minutes since midnight
  const slotStartMinutes = utcTimestampToLocalMinutes(selectedSlotStartUTC, timezone);
  const slotEndMinutes = utcTimestampToLocalMinutes(selectedSlotEndUTC, timezone);

  // Check if the entire slot fits within any time range for this day
  for (const timeRange of dayAvailability.timeRanges) {
    const availabilityStartMinutes = timeRange.startMinutes;
    const availabilityEndMinutes = timeRange.endMinutes;

    // MATCH CONDITION (CRITICAL):
    // availability.startMinutes <= sessionStartMinutes
    // AND
    // availability.endMinutes >= sessionEndMinutes
    // DO NOT check equality - use <= and >= to allow sessions that start/end exactly at boundaries
    // Handle ranges that cross midnight
    let fits = false;
    if (availabilityStartMinutes <= availabilityEndMinutes) {
      // Normal case: range doesn't cross midnight
      // Session can start at or after availability start, and end at or before availability end
      fits = availabilityStartMinutes <= slotStartMinutes && availabilityEndMinutes >= slotEndMinutes;
    } else {
      // Range crosses midnight (e.g., 22:00 - 02:00)
      // Slot must be entirely before midnight or entirely after
      fits = (availabilityStartMinutes <= slotStartMinutes && slotEndMinutes <= 1440) ||
             (slotStartMinutes >= 0 && availabilityEndMinutes >= slotEndMinutes);
    }

    if (fits) {
      return true;
    }
  }

  // Clear error message when returning false
  console.error('[isSlotWithinAvailability] Selected time is outside provider availability');
  return false;
}

/**
 * Check if a selected UTC time falls within a provider's availability range
 * Provider availability ranges are stored as minutes since midnight (local time)
 * 
 * NOTE: This function only checks if the start time falls within the range.
 * For booking validation, use isSlotWithinAvailability() which checks the entire slot.
 * 
 * @param selectedTimeUTC - ISO 8601 UTC timestamp string
 * @param availability - Provider availability configuration (times stored as minutes)
 * @param timezone - IANA timezone string (e.g., "America/New_York") - provider's timezone
 * @returns true if the selected time falls within any availability range for that day
 */
export function isTimeWithinAvailability(
  selectedTimeUTC: string, 
  availability: ProviderAvailability,
  timezone: string = 'UTC' // Default to UTC if not provided (for backward compatibility)
): boolean {
  // Normalize availability.days to ensure it's a safe array of length 7
  const safeDays = Array.isArray(availability.days) && availability.days.length === 7
    ? availability.days
    : Array.from({ length: 7 }, () => ({
        enabled: false,
        timeRanges: []
      }));

  const selectedDate = new Date(selectedTimeUTC);
  // Get day of week in provider's local timezone, not UTC
  // This is critical because availability is stored based on local time days
  const dayOfWeek = utcTimestampToLocalDayOfWeek(selectedTimeUTC, timezone);
  
  // Defensive guard: if safeDays[dayOfWeek] is undefined, return false
  const dayAvailability = safeDays[dayOfWeek];
  if (!dayAvailability || !dayAvailability.enabled) {
    return false;
  }

  // Convert UTC timestamp to local time minutes for comparison
  const selectedTimeMinutes = utcTimestampToLocalMinutes(selectedTimeUTC, timezone);

  // Check if the selected time falls within any time range for this day
  for (const timeRange of dayAvailability.timeRanges) {
    const startTimeMinutes = timeRange.startMinutes;
    const endTimeMinutes = timeRange.endMinutes;

    // Handle time ranges that cross midnight
    let timeWithinRange = false;
    
    if (startTimeMinutes <= endTimeMinutes) {
      // Normal case: range doesn't cross midnight
      timeWithinRange = selectedTimeMinutes >= startTimeMinutes && selectedTimeMinutes < endTimeMinutes;
    } else {
      // Range crosses midnight (e.g., 22:00 - 02:00)
      timeWithinRange = selectedTimeMinutes >= startTimeMinutes || selectedTimeMinutes < endTimeMinutes;
    }

    if (timeWithinRange) {
      return true;
    }
  }

  return false;
}
