'use server';

import { ProviderProfile } from '@/lib/models/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { getUserById } from '@/lib/auth/storage';

const PROVIDERS_TABLE = 'providers';

export type ProviderPayoutDetails = Pick<
  ProviderProfile,
  | 'payoutMethod'
  | 'wiseEmail'
  | 'paypalEmail'
  | 'zelleContact'
  | 'bankName'
  | 'bankAccountNumber'
  | 'bankRoutingNumber'
  | 'bankCountry'
  | 'accountHolderName'
>;

type ProviderDbRow = {
  id: string | null;
  user_id: string | null;
  data: any;
  created_at: string | null;
  updated_at: string | null;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function toIsoOrNow(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : fallback;
}

function normalizeProviderFromDbRow(row: ProviderDbRow): ProviderProfile | null {
  const rowId = typeof row?.id === 'string' ? row.id.trim() : '';
  const userId = typeof row?.user_id === 'string' ? row.user_id.trim() : '';
  const base = row?.data && typeof row.data === 'object' ? row.data : {};

  // Canonical provider id is the row id.
  const canonicalId = rowId || userId;
  if (!canonicalId) return null;

  const nowIso = new Date().toISOString();
  const createdAt = toIsoOrNow((base as any)?.createdAt ?? row?.created_at, nowIso);
  const updatedAt = toIsoOrNow((base as any)?.updatedAt ?? row?.updated_at, nowIso);

  const provider: any = { ...(base as any) };
  provider.id = canonicalId;
  provider.userId = isNonEmptyString((base as any)?.userId) ? String((base as any).userId).trim() : canonicalId;
  provider.createdAt = createdAt;
  provider.updatedAt = updatedAt;

  return provider as ProviderProfile;
}

function mergeProviderCompatibility(provider: ProviderProfile, user: any | null): ProviderProfile {
  if (!user || typeof user !== 'object') return provider;
  const p: any = { ...(provider as any) };

  // These fields historically live in users.data (profile page writes to user storage, not providers).
  // We only FILL missing provider fields; we never clobber payout/Stripe fields from providers storage.
  const userName = typeof user?.name === 'string' ? user.name.trim() : '';
  const userEmail = typeof user?.email === 'string' ? user.email.trim() : '';
  const userTimezone = typeof user?.timezone === 'string' ? user.timezone.trim() : '';

  const userProfilePhoto =
    (typeof user?.profilePhotoUrl === 'string' && user.profilePhotoUrl.trim() ? user.profilePhotoUrl.trim() : '') ||
    (typeof user?.profileImageUrl === 'string' && user.profileImageUrl.trim() ? user.profileImageUrl.trim() : '') ||
    '';

  if (!isNonEmptyString(p.displayName)) {
    p.displayName = userName || userEmail || p.userId || p.id;
  }

  if (!isNonEmptyString(p.profileImageUrl) && userProfilePhoto) {
    p.profileImageUrl = userProfilePhoto;
  }

  // Subjects often live on the user record (provider profile page writes `subjects` to user).
  if ((!Array.isArray(p.subjects) || p.subjects.length === 0) && Array.isArray(user?.subjects)) {
    p.subjects = user.subjects;
  }
  if ((!Array.isArray(p.specialties) || p.specialties.length === 0) && Array.isArray(user?.subjects)) {
    // Legacy: specialties mirrored subjects in several write paths.
    p.specialties = user.subjects;
  }

  if (!isNonEmptyString(p.timezone) && userTimezone) {
    p.timezone = userTimezone;
  }

  // Provider flags/ratings may exist on users; keep them as best-effort fields on provider payload.
  if (typeof p.ratingAverage !== 'number' && typeof user?.ratingAverage === 'number') p.ratingAverage = user.ratingAverage;
  if (typeof p.reviewCount !== 'number' && typeof user?.reviewCount === 'number') p.reviewCount = user.reviewCount;

  // Preserve the canonical id/userId relationship.
  if (!isNonEmptyString(p.userId)) p.userId = String(p.id || '').trim();
  if (!isNonEmptyString(p.id)) p.id = String(p.userId || '').trim();

  return p as ProviderProfile;
}

function looksLikeProviderUser(user: any | null): boolean {
  if (!user || typeof user !== 'object') return false;
  const roles: unknown = (user as any)?.roles;
  if (Array.isArray(roles)) {
    const set = new Set(roles.map((r) => String(r ?? '').trim().toLowerCase()).filter(Boolean));
    if (set.has('provider') || set.has('tutor') || set.has('counselor') || set.has('admin')) return true;
  }
  // Legacy flags
  if ((user as any)?.isTutor === true || (user as any)?.isCounselor === true) return true;
  return false;
}

function deriveProviderTypeFromUser(user: any): ProviderProfile['providerType'] {
  const services: unknown = (user as any)?.services;
  const has = (v: string) =>
    Array.isArray(services) && services.map((s: any) => String(s ?? '').trim().toLowerCase().replace(/-/g, '_')).includes(v);

  if ((user as any)?.offersVirtualTours === true || has('virtual_tour')) return 'counselor';
  if ((user as any)?.isCounselor === true || has('college_counseling') || has('counseling')) return 'counselor';
  if ((user as any)?.isTutor === true || has('tutoring') || has('test_prep') || has('testprep')) return 'tutor';
  return 'tutor';
}

async function ensureProviderRowExistsForUserId(userId: string): Promise<ProviderProfile | null> {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const user = await getUserById(uid);
  if (!looksLikeProviderUser(user)) return null;

  const now = new Date().toISOString();
  const name = typeof (user as any)?.name === 'string' ? String((user as any).name).trim() : '';
  const email = typeof (user as any)?.email === 'string' ? String((user as any).email).trim() : '';
  const displayName = name || email || uid;

  const provider: ProviderProfile = mergeProviderCompatibility(
    {
      id: uid,
      userId: uid,
      providerType: deriveProviderTypeFromUser(user),
      displayName,
      availabilityStatus: 'available',
      profileComplete: false,
      verified: false,
      active: true,
      createdAt: toIsoOrNow((user as any)?.createdAt, now),
      updatedAt: now,
    } as ProviderProfile,
    user as any
  );

  // Upsert best-effort so future reads don't need to synthesize again.
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(PROVIDERS_TABLE).upsert(
    {
      id: uid,
      user_id: uid,
      data: { ...(provider as any), id: uid, userId: uid },
      created_at: provider.createdAt || now,
      updated_at: provider.updatedAt || now,
    } as any,
    { onConflict: 'id' }
  );
  if (error) throw error;
  return provider;
}

// Read all providers from Supabase
export async function getProviders(): Promise<ProviderProfile[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(PROVIDERS_TABLE)
    .select('id, user_id, data, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[providers.storage] Error reading providers from Supabase:', error);
    throw error;
  }

  const providers = (data ?? [])
    .map((row: any) => normalizeProviderFromDbRow(row as ProviderDbRow))
    .filter(Boolean) as ProviderProfile[];

  // Compatibility: merge in provider fields that may still live on users.data.
  const ids = Array.from(new Set(providers.map((p) => String((p as any)?.userId || '').trim()).filter(Boolean)));
  if (ids.length === 0) return providers;

  // Chunk `.in()` to avoid oversized query strings.
  const userById = new Map<string, any>();
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data: users, error: uErr } = await supabase.from('users').select('id, data').in('id', chunk as any);
    if (uErr) throw uErr;
    for (const row of users ?? []) {
      const id = typeof (row as any)?.id === 'string' ? (row as any).id.trim() : '';
      const u = (row as any)?.data;
      if (id && u) userById.set(id, u);
    }
  }

  return providers.map((p) => mergeProviderCompatibility(p, userById.get(String(p.userId || '').trim()) || null));
}

// Upsert providers to Supabase (bulk)
export async function saveProviders(providers: ProviderProfile[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const rows = (providers || [])
    .filter(Boolean)
    .map((p: any) => {
      const userId = String(p?.userId || p?.id || '').trim();
      if (!userId) return null;
      // Canonicalize: row.id is provider user id; `data.id` must not override it.
      const createdAt = toIsoOrNow(p?.createdAt, now);
      const updatedAt = toIsoOrNow(p?.updatedAt, now);
      const data = { ...(p || {}), id: userId, userId };
      return {
        id: userId,
        user_id: userId,
        data,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return;
  const { error } = await supabase.from(PROVIDERS_TABLE).upsert(rows as any, { onConflict: 'id' });
  if (error) throw error;
}

// Get provider by ID
export async function getProviderById(id: string): Promise<ProviderProfile | null> {
  const pid = String(id || '').trim();
  if (!pid) return null;
  const supabase = getSupabaseAdmin();

  // Primary lookup: providers.id is canonical (provider user id).
  const { data, error } = await supabase
    .from(PROVIDERS_TABLE)
    .select('id, user_id, data, created_at, updated_at')
    .eq('id', pid)
    .maybeSingle();
  if (error) throw error;
  const provider = data ? normalizeProviderFromDbRow(data as any) : null;
  if (provider) {
    const user = await getUserById(String(provider.userId || pid));
    return mergeProviderCompatibility(provider, user as any);
  }

  // Backward-compat: if someone passes a userId but the row was stored under user_id only.
  const { data: byUser, error: byUserErr } = await supabase
    .from(PROVIDERS_TABLE)
    .select('id, user_id, data, created_at, updated_at')
    .eq('user_id', pid)
    .maybeSingle();
  if (byUserErr) throw byUserErr;
  const provider2 = byUser ? normalizeProviderFromDbRow(byUser as any) : null;
  if (provider2) {
    const user = await getUserById(String(provider2.userId || pid));
    return mergeProviderCompatibility(provider2, user as any);
  }

  // If no row exists, don't auto-synthesize here; callers should use getProviderByUserId for that behavior.
  return null;
}

// Get provider by userId
export async function getProviderByUserId(userId: string): Promise<ProviderProfile | null> {
  const uid = String(userId || '').trim();
  if (!uid) return null;

  // Fast path: look up by canonical id.
  const existing = await getProviderById(uid);
  if (existing) return existing;

  // Compatibility: some environments stored provider-only fields inside users.data without a provider row.
  // Synthesize + persist a minimal provider record so payout/stripe flows don't 404.
  return await ensureProviderRowExistsForUserId(uid);
}

// Create new provider
export async function createProvider(provider: Omit<ProviderProfile, 'createdAt' | 'updatedAt'>): Promise<ProviderProfile> {
  const now = new Date().toISOString();
  const userId = String((provider as any)?.userId || (provider as any)?.id || '').trim();
  if (!userId) {
    throw new Error('[providers.storage] Refusing to create provider without userId');
  }

  // Canonicalize id to provider user id for consistency across the app (sessions/reviews/earnings use userId).
  const newProvider: ProviderProfile = mergeProviderCompatibility(
    {
      ...(provider as any),
      id: userId,
      userId,
      createdAt: now,
      updatedAt: now,
    } as ProviderProfile,
    await getUserById(userId)
  );

  await saveProviders([newProvider]);
  return newProvider;
}

// Update provider
export async function updateProvider(id: string, updates: Partial<Omit<ProviderProfile, 'id' | 'userId' | 'createdAt'>>): Promise<ProviderProfile | null> {
  const pid = String(id || '').trim();
  if (!pid) return null;

  const existing = await getProviderById(pid);
  if (!existing) return null;

  const merged: ProviderProfile = {
    ...(existing as any),
    ...(updates as any),
    id: existing.id,
    userId: existing.userId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  } as ProviderProfile;

  await saveProviders([merged]);
  return merged;
}

/**
 * Persist provider availability inside providers.data.availability (Supabase only).
 *
 * Shape stored:
 * providers.data.availability = {
 *   [serviceType]: { providerId, serviceType, timezone, updatedAt, days, blocks }
 * }
 */
export async function updateProviderAvailability(
  providerId: string,
  availabilityPatch: Record<string, any>
): Promise<void> {
  const pid = String(providerId || '').trim();
  if (!pid) throw new Error('[providers.storage] Refusing to save availability with missing providerId');

  console.log("Saving provider:", pid);

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from(PROVIDERS_TABLE)
    .select('id, user_id, data')
    .eq('id', pid)
    .maybeSingle();
  if (error) throw error;

  const existingData = row?.data && typeof row.data === 'object' ? row.data : {};
  const existingAvailability =
    existingData?.availability && typeof existingData.availability === 'object' ? existingData.availability : {};

  const patch = availabilityPatch && typeof availabilityPatch === 'object' ? availabilityPatch : {};
  const nextAvailability = { ...(existingAvailability as any), ...(patch as any) };
  const nextData = { ...(existingData as any), availability: nextAvailability, id: pid, userId: pid };

  const { error: upsertErr } = await supabase.from(PROVIDERS_TABLE).upsert(
    {
      id: pid,
      user_id: pid,
      data: nextData,
    } as any,
    { onConflict: 'id' }
  );
  if (upsertErr) throw upsertErr;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v ? v : undefined;
}

/**
 * Update payout details for a provider (by provider userId).
 * Storage-only helper used by API routes and server actions.
 */
export async function updateProviderPayoutDetailsByUserId(
  userId: string,
  details: ProviderPayoutDetails
): Promise<ProviderProfile | null> {
  const provider = await getProviderByUserId(userId);
  if (!provider) return null;

  // IMPORTANT: Only update keys that are present on the input object.
  // This prevents accidental wiping of existing payout details on partial updates.
  const updates: ProviderPayoutDetails = {};
  const has = (k: keyof ProviderPayoutDetails) => Object.prototype.hasOwnProperty.call(details as any, k);

  if (has('payoutMethod')) updates.payoutMethod = normalizeOptionalString((details as any).payoutMethod);
  if (has('wiseEmail')) updates.wiseEmail = normalizeOptionalString((details as any).wiseEmail);
  if (has('paypalEmail')) updates.paypalEmail = normalizeOptionalString((details as any).paypalEmail);
  if (has('zelleContact')) updates.zelleContact = normalizeOptionalString((details as any).zelleContact);
  if (has('bankName')) updates.bankName = normalizeOptionalString((details as any).bankName);
  if (has('bankAccountNumber')) updates.bankAccountNumber = normalizeOptionalString((details as any).bankAccountNumber);
  if (has('bankRoutingNumber')) updates.bankRoutingNumber = normalizeOptionalString((details as any).bankRoutingNumber);
  if (has('bankCountry')) updates.bankCountry = normalizeOptionalString((details as any).bankCountry);
  if (has('accountHolderName')) updates.accountHolderName = normalizeOptionalString((details as any).accountHolderName);

  return updateProvider(provider.id, updates as any);
}

// Delete provider
export async function deleteProvider(id: string): Promise<boolean> {
  const pid = String(id || '').trim();
  if (!pid) return false;
  const supabase = getSupabaseAdmin();
  const { error, count } = await supabase.from(PROVIDERS_TABLE).delete({ count: 'exact' }).eq('id', pid);
  if (error) throw error;
  return (count ?? 0) > 0;
}


