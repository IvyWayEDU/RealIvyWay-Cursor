'use server';

import { isTimeWithinAvailability } from './utils';
import {
  readReservedSlotsFile as _readReservedSlotsFile,
  writeReservedSlotsFile as _writeReservedSlotsFile,
  isSlotReserved as _isSlotReserved,
  reserveSlotsAtomically as _reserveSlotsAtomically,
  unreserveSlotsAtomically as _unreserveSlotsAtomically,
  readAvailabilityFile,
} from './store.server';

/**
 * Time range stored as minutes since midnight (LOCAL time, no timezone conversion)
 * Example: 9:00 PM = 1260 minutes, 11:00 PM = 1380 minutes
 */
export interface TimeRange {
  startMinutes: number; // Minutes since midnight (0-1439), LOCAL time
  endMinutes: number; // Minutes since midnight (0-1439), LOCAL time
}

/**
 * Availability block for a specific date
 */
export interface AvailabilityBlock {
  start: string; // ISO 8601 UTC timestamp
  end: string; // ISO 8601 UTC timestamp
  providerId: string;
}

/**
 * Discrete slot record used for booking integrity.
 * A slot may be marked as RESERVED once a booking is in progress or completed.
 */
export type SlotStatus = 'available' | 'reserved';
export interface AvailabilitySlot {
  providerId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  // Backward-compat: legacy records may omit status; treat as "available" at read time.
  status?: SlotStatus;
}

// Reservation helpers live in the canonical store module (file-backed + atomic writes).
// NOTE: In a "use server" file, exports must be direct async function declarations
// (re-export statements are not allowed by Next/Turbopack).
export async function readReservedSlotsFile(): Promise<AvailabilitySlot[]> {
  return (await _readReservedSlotsFile()) as AvailabilitySlot[];
}

export async function writeReservedSlotsFile(slots: AvailabilitySlot[]): Promise<void> {
  await _writeReservedSlotsFile(slots as any);
}

export async function isSlotReserved(providerId: string, startTime: string, endTime: string): Promise<boolean> {
  return await _isSlotReserved(providerId, startTime, endTime);
}

export async function reserveSlotsAtomically(
  slots: Array<{ providerId: string; startTime: string; endTime: string }>
): Promise<
  | { ok: true }
  | { ok: false; conflict: { providerId: string; startTime: string; endTime: string } }
> {
  return await _reserveSlotsAtomically(slots);
}

export async function unreserveSlotsAtomically(
  slots: Array<{ providerId: string; startTime: string; endTime: string }>
): Promise<void> {
  await _unreserveSlotsAtomically(slots);
}

/**
 * Day availability configuration
 */
export interface DayAvailability {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  enabled: boolean;
  timeRanges: TimeRange[];
}

/**
 * Provider availability configuration
 * Stores weekly recurring availability at provider-level (not service-specific)
 * Availability is provider-level and role-based, NOT service-specific
 * 
 * NOTE: Times are stored as minutes since midnight in LOCAL time - no timezone conversions
 */
export interface ProviderAvailability {
  providerId: string;
  timezone?: string; // IANA timezone string (e.g., "America/New_York")
  days: DayAvailability[]; // Array of 7 days (Sunday through Saturday)
  updatedAt: string; // ISO 8601 datetime string
}

function safeDaysTemplate(): DayAvailability[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: false,
    timeRanges: [],
  }));
}

function daysFromBlocks(blocks: any[] | undefined | null): DayAvailability[] {
  const days = safeDaysTemplate();
  if (!Array.isArray(blocks)) return days;
  for (const b of blocks) {
    const dayOfWeek = Number((b as any)?.dayOfWeek);
    const startMinutes = Number((b as any)?.startMinutes);
    const endMinutes = Number((b as any)?.endMinutes);
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) continue;
    days[dayOfWeek].enabled = true;
    days[dayOfWeek].timeRanges.push({ startMinutes, endMinutes });
  }
  return days;
}

// Read all availability from Supabase-backed store (no filesystem).
export async function getAllAvailability(): Promise<ProviderAvailability[]> {
  const storage = await readAvailabilityFile();
  const byProvider = new Map<string, ProviderAvailability>();

  for (const entry of Object.values(storage || {})) {
    const providerId = typeof (entry as any)?.providerId === 'string' ? String((entry as any).providerId).trim() : '';
    if (!providerId) continue;
    const updatedAt = typeof (entry as any)?.updatedAt === 'string' ? String((entry as any).updatedAt) : new Date().toISOString();
    const timezone = typeof (entry as any)?.timezone === 'string' ? String((entry as any).timezone) : 'America/New_York';

    const next: ProviderAvailability = {
      providerId,
      timezone,
      updatedAt,
      days: daysFromBlocks((entry as any)?.blocks),
    };

    const prev = byProvider.get(providerId);
    if (!prev) {
      byProvider.set(providerId, next);
      continue;
    }

    // Prefer the newest record for a provider (best-effort).
    const prevMs = new Date(prev.updatedAt).getTime();
    const nextMs = new Date(next.updatedAt).getTime();
    if (Number.isFinite(nextMs) && (!Number.isFinite(prevMs) || nextMs >= prevMs)) {
      byProvider.set(providerId, next);
    }
  }

  return Array.from(byProvider.values());
}

export async function saveAllAvailability(availability: ProviderAvailability[]): Promise<void> {
  void availability;
  throw new Error('[availability.storage] saveAllAvailability is deprecated. Use Supabase-backed availability endpoints.');
}

// Get availability for a specific provider
// Returns null if not found (never returns undefined)
// Note: serviceType parameter is ignored (availability is provider-level, not service-specific)
export async function getProviderAvailability(
  providerId: string, 
  serviceType?: string // Deprecated: ignored for backward compatibility
): Promise<ProviderAvailability | null> {
  const allAvailability = await getAllAvailability();
  
  // Normalize allAvailability to always be an array
  const availabilityArray: ProviderAvailability[] = Array.isArray(allAvailability)
    ? allAvailability
    : (Object.values(allAvailability || {}) as ProviderAvailability[]);
  
  // Defensive guard: if array is empty, return null
  if (availabilityArray.length === 0) {
    return null;
  }
  
  // Filter to only entries for this providerId (ignore serviceType)
  const found = availabilityArray.find(av => {
    return av.providerId === providerId;
  });
  
  // Never return undefined, return null instead
  return found || null;
}

// Get all availability entries for a provider (across all serviceTypes)
export async function getProviderAvailabilityByServiceType(
  providerId: string
): Promise<ProviderAvailability[]> {
  const allAvailability = await getAllAvailability();
  return allAvailability.filter(av => av.providerId === providerId);
}

// Save or update provider availability (scoped by providerId only)
// IMPORTANT: availabilityBlocks must have times in UTC (ISO 8601 format)
export async function saveProviderAvailability(
  providerId: string,
  availabilityBlocks: ProviderAvailability
): Promise<void> {
  void providerId;
  void availabilityBlocks;
  throw new Error('[availability.storage] saveProviderAvailability is deprecated. Use Supabase-backed availability endpoints.');
}

// Delete provider availability
export async function deleteProviderAvailability(providerId: string): Promise<void> {
  void providerId;
  throw new Error('[availability.storage] deleteProviderAvailability is deprecated. Use Supabase-backed availability endpoints.');
}


/**
 * Find all providers available at a specific UTC time
 * NOTE: This function uses UTC as default timezone since timezone is no longer stored with availability.
 * For accurate results, timezone should be obtained from user profile and passed to isTimeWithinAvailability.
 * 
 * @param selectedTimeUTC - ISO 8601 UTC timestamp string
 * @returns Array of provider IDs that are available at the selected time
 */
export async function getAvailableProvidersAtTime(selectedTimeUTC: string): Promise<string[]> {
  const allAvailability = await getAllAvailability();
  const availableProviders: string[] = [];

  for (const availability of allAvailability) {
    // Use UTC as default timezone (timezone no longer stored with availability)
    // TODO: Get timezone from user profile for accurate matching
    if (isTimeWithinAvailability(selectedTimeUTC, availability, 'UTC')) {
      availableProviders.push(availability.providerId);
    }
  }

  return availableProviders;
}

/**
 * Get availability blocks for a specific date
 * Returns all availability blocks from all providers for the given date
 * 
 * NOTE: Availability is stored as minutes since midnight (local time, timezone-agnostic).
 * This function interprets those minutes as UTC hours for slot generation.
 * For accurate timezone handling, timezone should be obtained from user profile.
 * 
 * @param date - Date string in YYYY-MM-DD format or ISO 8601 format
 * @returns Array of availability blocks in UTC (ISO 8601 timestamps)
 */
export async function getAvailabilityByServiceAndDate(
  serviceType: string, // Deprecated: ignored for backward compatibility
  date: string
): Promise<AvailabilityBlock[]> {
  // Parse the date (accept ISO 8601 or YYYY-MM-DD)
  let targetDate: Date;
  if (date.includes('T')) {
    targetDate = new Date(date);
  } else {
    // YYYY-MM-DD format - parse as UTC to avoid timezone shifts
    const [year, month, day] = date.split('-').map(Number);
    targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }

  if (isNaN(targetDate.getTime())) {
    console.error('[getAvailabilityByServiceAndDate] Invalid date format:', date);
    return [];
  }

  // Get all availability (availability is provider-level, not service-specific)
  const allAvailability = await getAllAvailability();
  const filteredAvailability = allAvailability;

  const blocks: AvailabilityBlock[] = [];
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  for (const availability of filteredAvailability) {
    // Normalize availability.days to ensure it's a safe array of length 7
    const safeDays = Array.isArray(availability.days) && availability.days.length === 7
      ? availability.days
      : Array.from({ length: 7 }, () => ({
          enabled: false,
          timeRanges: []
        }));
    
    // Defensive guard: if safeDays[dayOfWeek] is undefined, skip
    const dayAvailability = safeDays[dayOfWeek];
    if (!dayAvailability || !dayAvailability.enabled) {
      continue;
    }

    // Times are stored as minutes since midnight (local time, timezone-agnostic)
    // Convert minutes to hours/minutes for UTC timestamp generation
    // NOTE: Interpreting as UTC for slot generation - timezone handling can be refined later
    for (const timeRange of dayAvailability.timeRanges) {
      const startHour = Math.floor(timeRange.startMinutes / 60);
      const startMin = timeRange.startMinutes % 60;
      const endHour = Math.floor(timeRange.endMinutes / 60);
      const endMin = timeRange.endMinutes % 60;

      // Create UTC timestamps for the target date
      const blockStart = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        startHour,
        startMin,
        0
      ));

      const blockEnd = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        endHour,
        endMin,
        0
      ));

      // Only include blocks in the future
      if (blockStart >= new Date()) {
        blocks.push({
          start: blockStart.toISOString(),
          end: blockEnd.toISOString(),
          providerId: availability.providerId,
        });
      }
    }
  }

  console.log("AVAILABILITY READ", { serviceType, date, blocks });
  return blocks;
}

