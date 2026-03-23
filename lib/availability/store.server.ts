'use server';

import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getUserById } from '@/lib/auth/storage';
import type { DayAvailability } from '@/lib/availability/types';
import { isFilePersistenceDisabled, warnFilePersistenceDisabled } from '@/lib/server/filePersistence.server';

const DATA_DIR = path.join(process.cwd(), 'data');
const AVAILABILITY_FILE = path.join(DATA_DIR, 'availability.json');
const RESERVED_SLOTS_FILE = path.join(DATA_DIR, 'reserved-slots.json');

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

declare global {
  // eslint-disable-next-line no-var
  var __ivywayAvailabilityWriteLock: Promise<void> | undefined;
}

async function withAvailabilityWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalThis.__ivywayAvailabilityWriteLock || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  globalThis.__ivywayAvailabilityWriteLock = prev.then(() => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  if (isFilePersistenceDisabled()) {
    return;
  }
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

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
  if (isFilePersistenceDisabled()) {
    warnFilePersistenceDisabled('reserved-slots.read', { file: RESERVED_SLOTS_FILE });
    return [];
  }
  await ensureDataDir();
  if (!existsSync(RESERVED_SLOTS_FILE)) return [];
  try {
    const raw = await readFile(RESERVED_SLOTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: any) => {
        const providerId = typeof s?.providerId === 'string' ? s.providerId : '';
        const startTime = toIsoOrEmpty(s?.startTime);
        const endTime = toIsoOrEmpty(s?.endTime);
        const status: SlotStatus = (s?.status ?? 'available') === 'reserved' ? 'reserved' : 'available';
        if (!providerId || !startTime || !endTime) return null;
        return { providerId, startTime, endTime, status } satisfies AvailabilitySlot;
      })
      .filter(Boolean) as AvailabilitySlot[];
  } catch (error) {
    console.error('[store.server] Error reading reserved slots file:', error);
    return [];
  }
}

export async function writeReservedSlotsFile(slots: AvailabilitySlot[]): Promise<void> {
  if (isFilePersistenceDisabled()) {
    warnFilePersistenceDisabled('reserved-slots.write', { file: RESERVED_SLOTS_FILE, attemptedCount: slots.length });
    return;
  }
  await ensureDataDir();
  const tempFile = `${RESERVED_SLOTS_FILE}.tmp`;
  await writeFile(tempFile, JSON.stringify(slots, null, 2), 'utf-8');
  await rename(tempFile, RESERVED_SLOTS_FILE);
}

export async function isSlotReserved(
  providerId: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const startIso = toIsoOrEmpty(startTime);
  const endIso = toIsoOrEmpty(endTime);
  if (!providerId || !startIso || !endIso) return false;
  const reserved = await readReservedSlotsFile();
  const key = slotKey(providerId, startIso, endIso);
  return reserved.some(
    (s) => (s.status ?? 'available') === 'reserved' && slotKey(s.providerId, s.startTime, s.endTime) === key
  );
}

export async function reserveSlotsAtomically(
  slots: Array<{ providerId: string; startTime: string; endTime: string }>
): Promise<{ ok: true } | { ok: false; conflict: { providerId: string; startTime: string; endTime: string } }> {
  return withAvailabilityWriteLock(async () => {
    const existing = await readReservedSlotsFile();
    const existingReserved = new Set(
      existing
        .filter((s) => (s.status ?? 'available') === 'reserved')
        .map((s) => slotKey(s.providerId, s.startTime, s.endTime))
    );

    const normalized = slots
      .map((s) => ({
        providerId: String(s.providerId || '').trim(),
        startTime: toIsoOrEmpty(s.startTime),
        endTime: toIsoOrEmpty(s.endTime),
        status: 'reserved' as const,
      }))
      .filter((s) => s.providerId && s.startTime && s.endTime);

    for (const s of normalized) {
      const key = slotKey(s.providerId, s.startTime, s.endTime);
      if (existingReserved.has(key)) {
        return { ok: false, conflict: { providerId: s.providerId, startTime: s.startTime, endTime: s.endTime } };
      }
    }

    // Append reservations (idempotent against duplicates)
    const next = [...existing];
    for (const s of normalized) {
      const key = slotKey(s.providerId, s.startTime, s.endTime);
      if (!existingReserved.has(key)) {
        next.push(s);
        existingReserved.add(key);
      }
    }

    await writeReservedSlotsFile(next);
    return { ok: true };
  });
}

export async function unreserveSlotsAtomically(
  slots: Array<{ providerId: string; startTime: string; endTime: string }>
): Promise<void> {
  await withAvailabilityWriteLock(async () => {
    const existing = await readReservedSlotsFile();
    const removeKeys = new Set(
      slots
        .map((s) => {
          const pid = String(s.providerId || '').trim();
          const startIso = toIsoOrEmpty(s.startTime);
          const endIso = toIsoOrEmpty(s.endTime);
          return pid && startIso && endIso ? slotKey(pid, startIso, endIso) : '';
        })
        .filter(Boolean)
    );
    if (removeKeys.size === 0) return;
    const next = existing.filter((s) => !removeKeys.has(slotKey(s.providerId, s.startTime, s.endTime)));
    await writeReservedSlotsFile(next);
  });
}

/**
 * Read availability file, return empty object if missing
 * Handles migration from old array format to new object format
 * Also handles migration from serviceType-scoped to provider-only format
 */
export async function readAvailabilityFile(): Promise<AvailabilityStorage> {
  await ensureDataDir();
  
  if (!existsSync(AVAILABILITY_FILE)) {
    return {};
  }
  
  try {
    const data = await readFile(AVAILABILITY_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    // IMPORTANT INTEGRITY RULE:
    // This function MUST be read-only. No migrations, no rewrites, no "default" row creation.
    // If stored data is in an older/odd shape, we adapt IN MEMORY only.

    // Legacy array format: treat as provider-level. We DO NOT persist any conversions here.
    if (Array.isArray(parsed)) {
      const storage: AvailabilityStorage = {};
      for (const item of parsed as any[]) {
        const providerId = typeof item?.providerId === 'string' ? item.providerId : String(item?.providerId || '').trim();
        if (!providerId) continue;
        const tz = typeof item?.timezone === 'string' && item.timezone.trim() ? item.timezone.trim() : 'America/New_York';
        const updatedAt = typeof item?.updatedAt === 'string' && item.updatedAt.trim() ? item.updatedAt.trim() : new Date().toISOString();
        const days = Array.isArray(item?.days) ? (item.days as DayAvailability[]) : undefined;
        const blocks = Array.isArray(item?.blocks) ? (item.blocks as AvailabilityBlock[]) : undefined;

        // In-memory compatibility: expose legacy provider-level availability under tutoring + college_counseling
        // so booking can still read it. We still DO NOT write anything back.
        for (const serviceType of ['tutoring', 'college_counseling'] as const) {
          storage[availabilityKey(providerId, serviceType)] = {
            providerId,
            serviceType,
            timezone: tz,
            updatedAt,
            days,
            blocks,
          };
        }
      }
      return storage;
    }

    // Object format: expect providerId:serviceType keys or entries with providerId + serviceType.
    const rawObj = (parsed && typeof parsed === 'object') ? (parsed as Record<string, any>) : {};
    const storage: AvailabilityStorage = {};
    for (const [rawKey, entry] of Object.entries(rawObj)) {
      if (!entry || typeof entry !== 'object') continue;

      const providerId =
        typeof (entry as any).providerId === 'string'
          ? (entry as any).providerId.trim()
          : String((entry as any).providerId || '').trim();
      if (!providerId) continue;

      const keyParts = String(rawKey).split(':');
      const inferredServiceType = keyParts.length >= 2 ? normalizeProviderServiceToAvailabilityServiceType(keyParts.slice(1).join(':')) : null;
      const serviceType = normalizeProviderServiceToAvailabilityServiceType((entry as any).serviceType) ?? inferredServiceType;
      if (!serviceType) {
        // Corrupt/unknown row; do not try to "fix" by expanding/duplicating.
        continue;
      }

      storage[availabilityKey(providerId, serviceType)] = {
        providerId,
        serviceType,
        timezone: (typeof (entry as any).timezone === 'string' && (entry as any).timezone.trim())
          ? (entry as any).timezone.trim()
          : 'America/New_York',
        updatedAt: (typeof (entry as any).updatedAt === 'string' && (entry as any).updatedAt.trim())
          ? (entry as any).updatedAt.trim()
          : new Date().toISOString(),
        // Stored exactly as-is (no sorting/normalization)
        days: Array.isArray((entry as any).days) ? ((entry as any).days as DayAvailability[]) : undefined,
        blocks: Array.isArray((entry as any).blocks) ? ((entry as any).blocks as AvailabilityBlock[]) : undefined,
      };
    }

    return storage;
  } catch (error) {
    console.error('[store.server] Error reading availability file:', error);
    return {};
  }
}

/**
 * Write availability file atomically
 */
export async function writeAvailabilityFile(data: AvailabilityStorage): Promise<void> {
  await ensureDataDir();
  
  // Transform-layer safety: never persist rows with missing/invalid serviceType.
  for (const [key, entry] of Object.entries(data || {})) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`[store.server] Refusing to write invalid availability entry at key=${key}`);
    }
    const providerId = String((entry as any).providerId || '').trim();
    const serviceType = (entry as any).serviceType;
    if (!providerId) {
      throw new Error(`[store.server] Refusing to write availability entry with missing providerId at key=${key}`);
    }
    if (!isCanonicalAvailabilityServiceType(serviceType)) {
      throw new Error(
        `[store.server] Refusing to write availability entry with invalid serviceType at key=${key} providerId=${providerId} serviceType=${String(serviceType)}`
      );
    }
  }
  
  // Write atomically by writing to a temp file first, then renaming
  const tempFile = `${AVAILABILITY_FILE}.tmp`;
  await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  
  // Rename is atomic on most filesystems
  await rename(tempFile, AVAILABILITY_FILE);
}

/**
 * Get availability for a provider
 * Returns null if not found
 */
export async function getAvailability(
  providerId: string,
  serviceType: CanonicalAvailabilityServiceType
): Promise<AvailabilityEntry | null> {
  const storage = await readAvailabilityFile();
  return storage[availabilityKey(providerId, serviceType)] || null;
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
  const storage = await readAvailabilityFile();
  
  storage[availabilityKey(providerId, serviceType)] = {
    providerId,
    serviceType,
    timezone,
    updatedAt: new Date().toISOString(),
    blocks,
    days,
  };
  
  await writeAvailabilityFile(storage);
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

  const storage = await readAvailabilityFile();
  const nowIso = new Date().toISOString();

  for (const serviceType of serviceTypes) {
    storage[availabilityKey(providerId, serviceType)] = {
      providerId,
      serviceType,
      timezone,
      updatedAt: nowIso,
      blocks,
    };
  }

  await writeAvailabilityFile(storage);
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
  const storage = await readAvailabilityFile();
  
  let changed = false;
  for (const key of Object.keys(storage)) {
    if (key === providerId || key.startsWith(`${providerId}:`)) {
      delete storage[key];
      changed = true;
    }
  }
  if (changed) await writeAvailabilityFile(storage);
}

function getZonedDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
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
