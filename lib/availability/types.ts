/**
 * Shared availability types used by client components and API payloads.
 * This file MUST NOT import any server-only modules.
 */

export interface TimeRangeMinutes {
  startMinutes: number; // 0-1439
  endMinutes: number; // 0-1439
}

export interface DayAvailability {
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  enabled: boolean;
  timeRanges: TimeRangeMinutes[];
}

export interface ProviderAvailability {
  providerId: string;
  timezone?: string; // IANA tz, e.g. "America/New_York"
  days: DayAvailability[]; // length 7
  updatedAt: string; // ISO string
}



