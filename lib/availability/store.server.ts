'use server';

import { getUserById } from '@/lib/auth/storage';
import type { DayAvailability } from '@/lib/availability/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { updateProviderAvailability, upsertProviderDataByUserId } from '@/lib/providers/storage';

const PROVIDERS_TABLE = 'providers';
const DEFAULT_TIME_ZONE = 'America/New_York';

export type SlotStatus = 'available' | 'reserved';

/**
 * Discrete reservation record for a specific provider/time window.
 * This is the booking integrity source-of-truth for "this slot has been taken".
 */
export interface AvailabilitySlot {
  providerId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  // Backward-compat: legacy records may omit status; treat as "available" at read time.
  status?: SlotStatus; // "available" | "reserved"
}

/**
 * Availability block stored as minutes since midnight (local time)
 */
export interface AvailabilityBlock {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startMinutes: number; // Minutes since midnight (0-1439)
  endMinutes: number; // Minutes since midnight (0-1439)
}

/**
 * Availability entry stored in the file
 * Availability is service-specific for filtering, but blocks are commonly duplicated
 * across serviceTypes for providers who offer multiple services.
 */
export interface AvailabilityEntry {
  providerId: string;
  serviceType: CanonicalAvailabilityServiceType;
  timezone: string;
  updatedAt: string; // UTC ISO string
  /**
   * Canonical persisted provider availability payload (preferred).
   * This is the only shape that /api/availability GET should return (exactly as saved).
   *
   * Legacy rows may omit this and only have `blocks`.
   */
  days?: DayAvailability[];
  /**
   * Derived blocks used by booking runtime for slot generation.
   * If present, it MUST be treated as persisted data (never regenerated or rewritten on reads).
   */
  blocks?: AvailabilityBlock[];
}

/**
 * Storage format: keyed object, scoped by providerId + serviceType:
 * {
 *   "providerId:serviceType": AvailabilityEntry
 * }
 */
type AvailabilityStorage = Record<string, AvailabilityEntry>;

type AvailabilityDbRow = {
  provider_id: string | null;
  service_type: string | null;
  timezone: string | null;
  updated_at: string | null;
  data: any;
};

/**
 * Canonical serviceType values persisted in availability rows.
 *
 * IMPORTANT:
 * - Booking’s /all-slots route maps virtual_tour requests to use college_counseling availability,
 *   but we still persist virtual_tour rows when the provider has virtual tours enabled to satisfy
 *   "duplicate availability blocks per enabled service".
 */
type CanonicalAvailabilityServiceType = 'tutoring' | 'college_counseling' | 'virtual_tour';

function normalizeProviderServiceToAvailabilityServiceType(raw: unknown): CanonicalAvailabilityServiceType | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/-/g, '_') : '';
  if (!v) return null;
  if (v === 'tutoring' || v === 'tutor' || v === 'test_prep' || v === 'testprep' || v === 'testprep_tutoring') {
    return 'tutoring';
  }
  if (v === 'college_counseling' || v === 'college_counselling' || v === 'counseling' || v === 'counsellor') {
    return 'college_counseling';
  }
  if (v === 'virtual_tour' || v === 'virtualtours' || v === 'virtual_tours' || v === 'virtualtour') {
    return 'virtual_tour';
  }
  return null;
}

function isCanonicalAvailabilityServiceType(value: unknown): value is CanonicalAvailabilityServiceType {
  return value === 'tutoring' || value === 'college_counseling' || value === 'virtual_tour';
}

async function getAvailabilityServiceTypesForProviderId(providerId: string): Promise<CanonicalAvailabilityServiceType[]> {
  const user = await getUserById(providerId);
  const set = new Set<CanonicalAvailabilityServiceType>();

  const services: unknown = (user as any)?.services ?? (user as any)?.serviceTypes ?? (user as any)?.profile?.serviceTypes;
  if (Array.isArray(services)) {
    for (const s of services) {
      const normalized = normalizeProviderServiceToAvailabilityServiceType(s);
      if (normalized) set.add(normalized);
    }
  }

  // Legacy/provider flags that appear in dev JSON
  if ((user as any)?.isTutor === true) set.add('tutoring');
  if ((user as any)?.isCounselor === true) set.add('college_counseling');

  // Strong signals
  if ((user as any)?.offersVirtualTours === true) {
    // Persist both: counselors must have college_counseling rows for counseling bookings,
    // and virtual_tour rows for explicit per-service duplication.
    set.add('college_counseling');
    set.add('virtual_tour');
  }
  if (Array.isArray((user as any)?.subjects) && (user as any).subjects.length > 0) set.add('tutoring');
  if (
    Array.isArray((user as any)?.schoolIds) && (user as any).schoolIds.length > 0 ||
    typeof (user as any)?.schoolId === 'string'
  ) {
    set.add('college_counseling');
  }

  // Last-resort fallback: if provider data is missing/underspecified, keep availability usable.
  // Booking still enforces provider eligibility separately; this does NOT loosen slot filtering.
  if (
    set.size === 0 &&
    Array.isArray((user as any)?.roles) &&
    ((user as any).roles.includes('provider') || (user as any).roles.includes('tutor') || (user as any).roles.includes('counselor'))
  ) {
    set.add('tutoring');
    set.add('college_counseling');
  }

  return Array.from(set);
}

function availabilityKey(providerId: string, serviceType: string): string {
  return `${providerId}:${serviceType}`;
}

function normalizeEnabledServicesToAvailabilityServiceTypes(enabledServices: unknown): CanonicalAvailabilityServiceType[] {
  if (!Array.isArray(enabledServices)) return [];
  const set = new Set<CanonicalAvailabilityServiceType>();
  for (const raw of enabledServices) {
    const normalized = normalizeProviderServiceToAvailabilityServiceType(raw);
    if (!normalized) continue;
    // Note: test_prep maps to tutoring at the availability row layer.
    set.add(normalized);
  }
  return Array.from(set);
}

function toIsoOrEmpty(value: string | undefined | null): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function slotKey(providerId: string, startTimeISO: string, endTimeISO: string): string {
  return `${providerId}|${startTimeISO}|${endTimeISO}`;
}

export async function readReservedSlotsFile(): Promise<AvailabilitySlot[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reserved_slots')
    .select('provider_id, datetime, end_datetime')
    .order('datetime', { ascending: true });
  if (error) {
    console.error('[store.server] Error reading reserved slots from Supabase:', error);
    throw error;
  }
  return (data ?? [])
    .map((row: any) => {
      const providerId = typeof row?.provider_id === 'string' ? row.provider_id : '';
      const startTime = toIsoOrEmpty(row?.datetime);
      const endTime = toIsoOrEmpty(row?.end_datetime);
      if (!providerId || !startTime || !endTime) return null;
      return { providerId, startTime, endTime, status: 'reserved' as const } satisfies AvailabilitySlot;
    })
    .filter(Boolean) as AvailabilitySlot[];
}

export async function writeReservedSlotsFile(slots: AvailabilitySlot[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalized = (slots || [])
    .map((s) => ({
      provider_id: String((s as any)?.providerId || '').trim(),
      datetime: toIsoOrEmpty((s as any)?.startTime),
      end_datetime: toIsoOrEmpty((s as any)?.endTime),
    }))
    .filter((s) => s.provider_id && s.datetime && s.end_datetime);

  // Compatibility with older dev reset flows: treat as "replace all".
  // The runtime booking flow does NOT call this; it uses `reserveSlotsAtomically`.
  const { error: delErr } = await supabase.from('reserved_slots').delete().neq('provider_id', '');
  if (delErr) throw delErr;

  if (normalized.length === 0) return;
  const { error: insErr } = await supabase.from('reserved_slots').insert(normalized);
  if (insErr) throw insErr;
}

export async function isSlotReserved(
  providerId: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const startIso = toIsoOrEmpty(startTime);
  const endIso = toIsoOrEmpty(endTime);
  if (!providerId || !startIso || !endIso) return false;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reserved_slots')
    .select('id')
    .eq('provider_id', String(providerId))
    .eq('datetime', startIso)
    .eq('end_datetime', endIso)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function reserveSlotsAtomically(
  slots: Array<{ providerId: string; startTime: string; endTime: string }>
): Promise<{ ok: true } | { ok: false; conflict: { providerId: string; startTime: string; endTime: string } }> {
  const normalized = (slots || [])
    .map((s) => ({
      provider_id: String(s?.providerId || '').trim(),
      datetime: toIsoOrEmpty(s?.startTime),
      end_datetime: toIsoOrEmpty(s?.endTime),
    }))
    .filter((s) => s.provider_id && s.datetime && s.end_datetime);

  if (normalized.length === 0) return { ok: true };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('reserve_slots_atomically', { slots: normalized as any });
  if (error) throw error;

  const out: any = data as any;
  if (out?.ok === true) return { ok: true };

  const c = out?.conflict || null;
  if (c && typeof c === 'object') {
    return {
      ok: false,
      conflict: {
        providerId: String((c as any).provider_id || ''),
        startTime: toIsoOrEmpty((c as any).datetime) || '',
        endTime: toIsoOrEmpty((c as any).end_datetime) || '',
      },
    };
  }

  // Defensive fallback
  return {
    ok: false,
    conflict: {
      providerId: normalized[0].provider_id,
      startTime: normalized[0].datetime,
      endTime: normalized[0].end_datetime,
    },
  };
}

export async function unreserveSlotsAtomically(
  slots: Array<{ providerId: string; startTime: string; endTime: string }>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  for (const s of slots || []) {
    const pid = String(s?.providerId || '').trim();
    const startIso = toIsoOrEmpty(s?.startTime);
    const endIso = toIsoOrEmpty(s?.endTime);
    if (!pid || !startIso || !endIso) continue;
    const { error } = await supabase
      .from('reserved_slots')
      .delete()
      .eq('provider_id', pid)
      .eq('datetime', startIso)
      .eq('end_datetime', endIso);
    if (error) throw error;
  }
}

function normalizeAvailabilityEntryFromProviderRow(params: {
  providerId: string;
  serviceType: string;
  payload: any;
}): AvailabilityEntry | null {
  const providerId = String(params.providerId || '').trim();
  const serviceType = normalizeProviderServiceToAvailabilityServiceType(params.serviceType);
  if (!providerId || !serviceType) return null;

  const base = params.payload && typeof params.payload === 'object' ? params.payload : {};
  const updatedAt =
    typeof base?.updatedAt === 'string' && base.updatedAt.trim() ? base.updatedAt.trim() : new Date().toISOString();
  const timezone =
    typeof base?.timezone === 'string' && base.timezone.trim() ? base.timezone.trim() : 'America/New_York';
  const days = Array.isArray(base?.days) ? (base.days as DayAvailability[]) : undefined;
  const blocks = Array.isArray(base?.blocks) ? (base.blocks as AvailabilityBlock[]) : undefined;

  return { providerId, serviceType, timezone, updatedAt, days, blocks };
}

/**
 * Read availability from Supabase (no filesystem fallbacks).
 */
export async function readAvailabilityFile(): Promise<AvailabilityStorage> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(PROVIDERS_TABLE)
    .select('id, data')
    .order('id', { ascending: true });
  if (error) {
    console.error('[store.server] Error reading availability from Supabase:', error);
    throw error;
  }

  const storage: AvailabilityStorage = {};
  for (const row of (data ?? []) as any[]) {
    const providerId = typeof (row as any)?.id === 'string' ? String((row as any).id).trim() : '';
    if (!providerId) continue;
    const providerData = (row as any)?.data && typeof (row as any).data === 'object' ? (row as any).data : {};

    const availabilityRaw = (providerData as any)?.availability;

    const candidates: Array<{ serviceType: string; payload: any }> = [];
    if (Array.isArray(availabilityRaw)) {
      for (const a of availabilityRaw) {
        const st = typeof (a as any)?.serviceType === 'string' ? String((a as any).serviceType).trim() : '';
        if (!st) continue;
        candidates.push({ serviceType: st, payload: a });
      }
    } else if (availabilityRaw && typeof availabilityRaw === 'object') {
      for (const [st, payload] of Object.entries(availabilityRaw as Record<string, any>)) {
        if (!st) continue;
        candidates.push({ serviceType: String(st), payload });
      }
    }

    for (const c of candidates) {
      const entry = normalizeAvailabilityEntryFromProviderRow({
        providerId,
        serviceType: c.serviceType,
        payload: c.payload,
      });
      if (!entry) continue;
      storage[availabilityKey(entry.providerId, entry.serviceType)] = entry;
    }
  }

  return storage;
}

/**
 * Upsert one availability entry (Supabase-only).
 */
async function upsertAvailabilityEntry(entry: AvailabilityEntry): Promise<void> {
  const providerId = String((entry as any).providerId || '').trim();
  const serviceType = (entry as any).serviceType;
  if (!providerId) throw new Error('[store.server] Refusing to write availability entry with missing providerId');
  if (!isCanonicalAvailabilityServiceType(serviceType)) {
    throw new Error(`[store.server] Refusing to write availability entry with invalid serviceType=${String(serviceType)}`);
  }

  await updateProviderAvailability(providerId, {
    serviceType,
    timezone: entry.timezone || 'America/New_York',
    updatedAt: entry.updatedAt || new Date().toISOString(),
    days: (entry as any).days,
    blocks: (entry as any).blocks,
  } as any);
}

/**
 * Get availability for a provider
 * Returns null if not found
 */
export async function getAvailability(
  providerId: string,
  serviceType: CanonicalAvailabilityServiceType
): Promise<AvailabilityEntry | null> {
  const pid = String(providerId || '').trim();
  if (!pid) return null;
  const storage = await readAvailabilityFile();
  const key = availabilityKey(pid, String(serviceType || '').trim());
  const entry = (storage as any)?.[key] ?? null;
  return entry ? (entry as AvailabilityEntry) : null;
}

/**
 * Set availability for a provider
 * @param providerId - Provider ID
 * @param blocks - Array of availability blocks
 * @param timezone - Timezone string (default: "America/New_York")
 */
export async function setAvailability(
  providerId: string,
  blocks: AvailabilityBlock[],
  timezone: string = 'America/New_York',
  serviceType: CanonicalAvailabilityServiceType = 'college_counseling',
  days?: DayAvailability[]
): Promise<void> {
  const entry: AvailabilityEntry = {
    providerId,
    serviceType,
    timezone,
    updatedAt: new Date().toISOString(),
    blocks,
    days,
  };
  await upsertAvailabilityEntry(entry);
}

/**
 * Persist availability blocks with explicit serviceType rows.
 * If provider offers multiple services, blocks are duplicated per serviceType.
 */
export async function setAvailabilityForProviderServices(
  providerId: string,
  blocks: AvailabilityBlock[],
  timezone: string = 'America/New_York',
  enabledServices?: unknown
): Promise<{ serviceTypes: CanonicalAvailabilityServiceType[] }> {
  // IMPORTANT INTEGRITY RULE:
  // This helper MUST NOT delete or overwrite other service availability implicitly.
  // It is kept for backward compatibility, but requires explicit enabledServices.
  const explicitServiceTypes = normalizeEnabledServicesToAvailabilityServiceTypes(enabledServices);
  const serviceTypes = explicitServiceTypes;
  if (serviceTypes.length === 0) {
    throw new Error('enabledServices is required to persist availability for multiple services');
  }

  const nowIso = new Date().toISOString();

  for (const serviceType of serviceTypes) {
    const entry: AvailabilityEntry = {
      providerId,
      serviceType,
      timezone,
      updatedAt: nowIso,
      blocks,
    };
    await upsertAvailabilityEntry(entry);
  }
  return { serviceTypes };
}

/**
 * Retag (and/or duplicate) existing availability entries for a provider so the persisted
 * serviceType rows reflect the provider's CURRENT enabled services.
 *
 * This is a data-consistency helper invoked when providers change their offered services.
 *
 * Rules:
 * - Never delete time ranges: existing blocks are preserved and copied onto the new service rows.
 * - If multiple services are enabled, blocks are duplicated per serviceType (booking expects 1 serviceType per row).
 *
 * Logs:
 *   [AVAILABILITY_SERVICE_SYNC] { providerId, oldTypes, newTypes }
 */
export async function syncAvailabilityServiceTypesForProvider(
  providerId: string,
  enabledServices?: unknown
): Promise<{ oldTypes: CanonicalAvailabilityServiceType[]; newTypes: CanonicalAvailabilityServiceType[] }> {
  // DEPRECATED:
  // Availability must ONLY change on explicit POST /api/availability saves.
  // Service/profile changes must not retag/duplicate/delete availability.
  console.warn('[AVAILABILITY_SERVICE_SYNC_BLOCKED]', { providerId, enabledServices });
  return { oldTypes: [], newTypes: [] };
}

/**
 * Delete availability for a provider
 */
export async function deleteAvailability(
  providerId: string
): Promise<void> {
  const pid = String(providerId || '').trim();
  if (!pid) return;
  await upsertProviderDataByUserId(pid, { availability: [] });
}

function getZonedDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
} {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : DEFAULT_TIME_ZONE;
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;

  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).getUTCDay();

  return { year, month, day, hour, minute, dayOfWeek };
}

/**
 * Consume (remove) a booked slot from provider availability.
 * Booked slot is defined by scheduledStart -> scheduledEnd (ISO strings).
 *
 * IMPORTANT: Availability blocks are stored as minutes since midnight in provider LOCAL time.
 */
export async function consumeBookedSlot(
  providerId: string,
  scheduledStart: string,
  scheduledEnd: string
): Promise<void> {
  // CRITICAL INTEGRITY RULE:
  // Booking must be READ-ONLY with respect to stored availability.
  // We rely on sessions + reserved-slots to exclude booked times.
  console.warn('[AVAILABILITY_CONSUME_BLOCKED]', { providerId, scheduledStart, scheduledEnd });
}
