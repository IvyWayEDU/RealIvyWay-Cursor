import 'server-only';

import { Session, SessionStatus, CancellationReason } from '@/lib/models/types';
import { getSessionEndTimeMs, isSessionCompleted, isSessionUpcoming } from '@/lib/sessions/lifecycle';
import { resolveSessionStatusByTime } from '@/lib/sessions/status-resolver';
import { getEarningsServiceLabel } from '@/lib/earnings/serviceLabel';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

function toIsoStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  // Accept strings, numbers (timestamps), and Date-like objects.
  const d = v instanceof Date ? v : new Date(v as any);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return d.toISOString();
}

type SessionDbRow = {
  id: string | null;
  datetime: string | null;
  end_datetime: string | null;
  status: string | null;
  provider_joined_at: string | null;
  student_joined_at: string | null;
  data: any;
};

function mergeDbRowIntoSession(row: SessionDbRow): Session | null {
  const base: any = row?.data && typeof row.data === 'object' ? row.data : {};
  const s: any = { ...base };

  const rowId = typeof row?.id === 'string' ? row.id.trim() : '';
  if (!rowId) return null;
  // IMPORTANT: The DB row id is canonical. Never allow `data.id` to override it,
  // otherwise reads/normalization can "upsert" under a different id and create duplicates.
  s.id = rowId;

  // Canonical start/end come from DB columns: datetime/end_datetime (per product spec).
  // Fallbacks: legacy JSON fields when DB columns are missing.
  // End defaults to start + 60 minutes when end_datetime is missing.
  const startIso =
    toIsoStringOrNull(row?.datetime) ||
    toIsoStringOrNull(s.startTime) ||
    toIsoStringOrNull(s.scheduledStartTime) ||
    toIsoStringOrNull(s.scheduledStart);

  if (startIso) {
    s.startTime = startIso;
    s.scheduledStartTime = toIsoStringOrNull(s.scheduledStartTime) || startIso;
    s.scheduledStart = toIsoStringOrNull(s.scheduledStart) || s.scheduledStartTime || startIso;
  }

  const endIsoFromRow = toIsoStringOrNull(row?.end_datetime);
  const endIsoDefault =
    startIso ? new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString() : null;
  const endIsoFromData =
    toIsoStringOrNull(s.endTime) || toIsoStringOrNull(s.scheduledEndTime) || toIsoStringOrNull(s.scheduledEnd);
  const endIso = endIsoFromRow || endIsoDefault || endIsoFromData;

  if (endIso) {
    s.endTime = endIso;
    s.scheduledEndTime = toIsoStringOrNull(s.scheduledEndTime) || endIso;
    s.scheduledEnd = toIsoStringOrNull(s.scheduledEnd) || s.scheduledEndTime || endIso;
  }

  // Expose canonical DB columns to the frontend (source-of-truth fields).
  // CRITICAL: callers rely on `session.datetime` and `session.end_datetime` (snake_case)
  // for join gating and other UI logic.
  if (startIso) {
    s.datetime = startIso;
  }
  if (endIsoFromRow) {
    s.end_datetime = endIsoFromRow;
  } else if (endIso) {
    // When DB end is missing, still provide a best-effort end_datetime for UI logic.
    s.end_datetime = endIso;
  }

  // Prefer DB column status when present (authoritative for querying).
  if (typeof row?.status === 'string' && row.status.trim()) {
    s.status = row.status.trim();
  }

  // Mirror join evidence columns into JSON if missing/invalid there.
  const providerJoinedAtData = toIsoStringOrNull(s.providerJoinedAt);
  const studentJoinedAtData = toIsoStringOrNull(s.studentJoinedAt);
  const providerJoinedAtRow = toIsoStringOrNull(row?.provider_joined_at);
  const studentJoinedAtRow = toIsoStringOrNull(row?.student_joined_at);
  if (!providerJoinedAtData && providerJoinedAtRow) s.providerJoinedAt = providerJoinedAtRow;
  if (!studentJoinedAtData && studentJoinedAtRow) s.studentJoinedAt = studentJoinedAtRow;

  // Also expose the join columns directly (snake_case) for UI consumers.
  s.provider_joined_at = providerJoinedAtRow || providerJoinedAtData || null;
  s.student_joined_at = studentJoinedAtRow || studentJoinedAtData || null;

  return s as Session;
}

// Read sessions from Supabase (DB columns + JSON payload).
async function readSessionsRaw(): Promise<Session[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, datetime, end_datetime, status, provider_joined_at, student_joined_at, data')
    .order('datetime', { ascending: true });
  if (error) {
    console.error('[sessions.storage] Error reading sessions from Supabase:', error);
    throw error;
  }
  return (data ?? [])
    .map((row: any) => mergeDbRowIntoSession(row as SessionDbRow))
    .filter(Boolean) as Session[];
}

async function readSessionByIdRaw(id: string): Promise<Session | null> {
  const sid = String(id || '').trim();
  if (!sid) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, datetime, end_datetime, status, provider_joined_at, student_joined_at, data')
    .eq('id', sid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mergeDbRowIntoSession(data as any);
}

type NormalizedSessionFields = {
  startTime: string; // ISO
  endTime: string; // ISO
  date: string; // YYYY-MM-DD
  providerId: string;
  studentId: string;
  providerName: string;
  studentName: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isIsoDateYYYYMMDD(v: unknown): v is string {
  return isNonEmptyString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isoDateFromIso(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(iso).toISOString().slice(0, 10);
}

function buildUserNameById(users: Array<{ id: string; name?: string }>): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of users) {
    if (!u?.id) continue;
    if (isNonEmptyString(u.name)) m.set(u.id, u.name);
  }
  return m;
}

function isUnknownProviderName(v: unknown): boolean {
  if (!isNonEmptyString(v)) return true;
  return v.trim().toLowerCase() === 'unknown provider';
}

function extractUuidV4Candidates(input: string): string[] {
  // Strict-ish UUID v4/v5 matcher (accepts 1-5 for version to avoid over-restricting old ids).
  const re = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  const matches = input.match(re) || [];
  // Uniq (case-insensitive)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const norm = m.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(m);
  }
  return out;
}

type ProviderResolutionContext = {
  providerIds: Set<string>;
  providerNameById: Map<string, string>;
  singleProviderId: string | null;
  // key: `${startIso}|${endIso}` => Set(providerId)
  reservedProvidersByTime: Map<string, Set<string>>;
};

function buildProviderResolutionContext(
  users: Array<{ id: string; name?: string; roles?: unknown }>,
  reservedSlots: Array<{ providerId: string; startTime: string; endTime: string; status?: string }>
): ProviderResolutionContext {
  const providerIds = new Set<string>();
  const providerNameById = new Map<string, string>();
  for (const u of users) {
    const id = (u as any)?.id;
    if (!isNonEmptyString(id)) continue;
    const roles = (u as any)?.roles;
    if (Array.isArray(roles) && roles.includes('provider')) {
      providerIds.add(id);
      if (isNonEmptyString((u as any)?.name)) providerNameById.set(id, String((u as any).name));
    }
  }

  const providerList = Array.from(providerIds);
  const singleProviderId = providerList.length === 1 ? providerList[0] : null;

  const reservedProvidersByTime = new Map<string, Set<string>>();
  for (const slot of reservedSlots || []) {
    const status = (slot as any)?.status ?? 'available';
    if (status !== 'reserved') continue;
    const pid = (slot as any)?.providerId;
    const start = toIsoStringOrNull((slot as any)?.startTime);
    const end = toIsoStringOrNull((slot as any)?.endTime);
    if (!isNonEmptyString(pid) || !start || !end) continue;
    const key = `${start}|${end}`;
    const set = reservedProvidersByTime.get(key) || new Set<string>();
    set.add(pid);
    reservedProvidersByTime.set(key, set);
  }

  return { providerIds, providerNameById, singleProviderId, reservedProvidersByTime };
}

function looksLikeLegacyOrTestProviderRef(session: any): boolean {
  const providerId = isNonEmptyString(session?.providerId) ? String(session.providerId) : '';
  if (!providerId) return true;

  // Obvious legacy/test id patterns seen in older seed data
  if (providerId.startsWith('provider-')) return true;
  if (/^\d+$/.test(providerId)) return true;
  if (providerId.toLowerCase() === 'pending') return true;

  // Additional signal: older seed data used "pending" serviceTypeId/availabilityId and $0 amounts.
  const serviceTypeId = isNonEmptyString(session?.serviceTypeId) ? String(session.serviceTypeId) : '';
  const availabilityId = isNonEmptyString(session?.availabilityId) ? String(session.availabilityId) : '';
  const priceCents = Number((session as any)?.priceCents);
  if ((serviceTypeId === 'pending' || availabilityId === 'pending') && (Number.isFinite(priceCents) ? priceCents === 0 : true)) {
    return true;
  }

  return false;
}

function normalizeProviderForReadOnly(session: Session, ctx: ProviderResolutionContext): Session {
  // Non-destructive: returns a patched copy when we can be certain; never mutates the input object.
  const s: any = session as any;

  const providerNameUnknown = isUnknownProviderName(s?.providerName);
  const providerIdRaw = isNonEmptyString(s?.providerId) ? String(s.providerId).trim() : '';
  const hasValidProviderId = providerIdRaw && ctx.providerIds.has(providerIdRaw);

  // Per requirements, only attempt resolution when providerName is missing/"Unknown Provider".
  if (!providerNameUnknown) return session;

  // 1) If providerId is already a real provider user id, only backfill the name.
  if (hasValidProviderId) {
    const name = ctx.providerNameById.get(providerIdRaw);
    if (isNonEmptyString(name) && name !== s.providerName) {
      return { ...(session as any), providerName: name } as Session;
    }
    return session;
  }

  // Need canonical times for deterministic matching.
  const startIso = toIsoStringOrNull(s?.startTime) || toIsoStringOrNull(s?.scheduledStartTime) || toIsoStringOrNull(s?.scheduledStart);
  const endIso = toIsoStringOrNull(s?.endTime) || toIsoStringOrNull(s?.scheduledEndTime) || toIsoStringOrNull(s?.scheduledEnd);

  // 2) Try exact reserved-slot match by (start,end) => providerId.
  if (startIso && endIso) {
    const key = `${startIso}|${endIso}`;
    const providers = ctx.reservedProvidersByTime.get(key);
    if (providers && providers.size === 1) {
      const [pid] = Array.from(providers);
      if (ctx.providerIds.has(pid)) {
        const name = ctx.providerNameById.get(pid);
        if (isNonEmptyString(name)) {
          return { ...(session as any), providerId: pid, providerName: name } as Session;
        }
        // Provider exists but no name in map; still safe to backfill id and keep existing name.
        return { ...(session as any), providerId: pid } as Session;
      }
    }
  }

  // 3) Try extracting a real provider UUID embedded in a legacy providerId string.
  if (providerIdRaw) {
    const candidates = extractUuidV4Candidates(providerIdRaw).filter((c) => ctx.providerIds.has(c));
    if (candidates.length === 1) {
      const pid = candidates[0];
      const name = ctx.providerNameById.get(pid);
      if (isNonEmptyString(name)) {
        return { ...(session as any), providerId: pid, providerName: name } as Session;
      }
      return { ...(session as any), providerId: pid } as Session;
    }
  }

  // 4) Last resort (ONLY for legacy/test sessions): if exactly one provider user exists, backfill.
  if (ctx.singleProviderId && looksLikeLegacyOrTestProviderRef(s)) {
    const pid = ctx.singleProviderId;
    const name = ctx.providerNameById.get(pid);
    if (isNonEmptyString(name)) {
      return { ...(session as any), providerId: pid, providerName: name } as Session;
    }
    return { ...(session as any), providerId: pid } as Session;
  }

  // Ambiguous or cannot be proven safe.
  return session;
}

function hydrateParticipantNames(_session: any, _userNameById: Map<string, string>) {
  // STRICT BOOKING FLOW:
  // Do not hydrate names from the user DB at read-time. Sessions must persist embedded snapshots.
}

function requireStrictPaidSessionFields(session: any, nowMs: number): boolean {
  // Required fields per spec (strict booking flow)
  // Canonical status: sessions created from paid bookings MUST be `confirmed`.
  // Historical statuses are normalized here to avoid persisting "upcoming" (forbidden).
  const rawStatus = isNonEmptyString(session?.status) ? String(session.status).trim() : '';
  if (rawStatus) {
    const normalized = rawStatus.toLowerCase();
    if (
      normalized === 'upcoming' ||
      normalized === 'scheduled' ||
      normalized === 'paid' ||
      normalized === 'in_progress' ||
      normalized === 'in_progress_pending_join'
    ) {
      session.status = 'confirmed';
    }
    if (normalized === 'flagged') {
      session.status = 'confirmed';
    }
    // Canonicalize legacy variants to the supported lifecycle model (best-effort, non-destructive).
    // We keep auxiliary metadata fields (e.g., refund amounts) intact; only the status label is normalized.
    if (normalized === 'no_show_provider' || normalized === 'expired_provider_no_show') {
      session.status = 'provider_no_show';
    }
    if (normalized === 'no_show_student') {
      session.status = 'student_no_show';
    }
    if (normalized === 'no_show_both') {
      session.status = 'provider_no_show';
      session.noShowParty = 'both';
    }
    if (normalized === 'no-show') {
      session.status = 'provider_no_show';
    }
    if (normalized === 'expired') {
      session.status = 'confirmed';
    }
    if (normalized === 'cancelled-late') {
      session.status = 'cancelled';
    }
    if (normalized === 'refunded') {
      session.status = 'cancelled';
    }
    if (normalized === 'requires_review') {
      // "requires_review" is not part of the canonical lifecycle; treat as confirmed so time-based completion applies.
      session.status = 'confirmed';
    }
  }

  // Canonical service type
  // IMPORTANT: This must run BEFORE required-field validation so legacy records with only
  // `serviceTypeId` / `sessionType` can still be updated/resolved without being rejected.
  if (!isNonEmptyString(session?.serviceType)) {
    const fallback =
      (isNonEmptyString(session?.serviceTypeId) ? String(session.serviceTypeId) : '') ||
      (isNonEmptyString(session?.sessionType) ? String(session.sessionType) : '');
    const v = fallback.trim().toLowerCase().replace(/-/g, '_');
    if (v) session.serviceType = v;
  }

  const requiredStrings = [
    'id',
    'studentId',
    'providerId',
    'startTime',
    'endTime',
    'serviceType',
    'status',
  ];
  for (const k of requiredStrings) {
    if (!isNonEmptyString(session?.[k])) return false;
  }

  const st = String(session.serviceType).trim().toLowerCase().replace(/-/g, '_');
  session.serviceType = st;
  if (!['tutoring', 'college_counseling', 'virtual_tour', 'test_prep'].includes(st)) return false;

  // Required status values
  if (!isNonEmptyString(session?.status)) return false;

  // For newly created paid sessions we require confirmed.
  const allowedStatuses = new Set<SessionStatus>([
    'confirmed',
    'completed',
    'cancelled',
    'provider_no_show',
    'student_no_show',
  ]);
  if (!allowedStatuses.has(session.status as SessionStatus)) return false;

  // start/end must be valid ISO and end > start
  const startIso = toIsoStringOrNull(session.startTime);
  const endIso = toIsoStringOrNull(session.endTime);
  if (!startIso || !endIso) return false;
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) return false;

  // Canonical copies (persisted)
  session.startTime = startIso;
  session.endTime = endIso;
  session.scheduledStartTime = startIso;
  session.scheduledEndTime = endIso;
  session.scheduledStart = startIso;
  session.scheduledEnd = endIso;
  session.date = isoDateFromIso(startIso) || new Date(nowMs).toISOString().slice(0, 10);

  // Ensure required legacy fields stay present for callers that still read them.
  session.serviceTypeId = isNonEmptyString(session.serviceTypeId) ? session.serviceTypeId : session.serviceType;
  // sessionType is a legacy field used by some UI/flows. Keep it consistent with serviceType.
  // CRITICAL: virtual_tour MUST NOT be normalized into 'counseling' (earnings would display it as counseling).
  const desiredSessionType =
    session.serviceType === 'tutoring'
      ? 'tutoring'
      : session.serviceType === 'test_prep'
        ? 'test-prep'
        : session.serviceType === 'virtual_tour'
          ? 'virtual-tour'
          : 'counseling';

  const beforeSessionType = isNonEmptyString(session.sessionType) ? String(session.sessionType) : '';
  if (!beforeSessionType || beforeSessionType !== desiredSessionType) {
    session.sessionType = desiredSessionType;

    // Log only when we actually correct the legacy sessionType mapping (prevents noisy logs).
    const st = String(session.serviceType || '').trim().toLowerCase().replace(/-/g, '_');
    const label = getEarningsServiceLabel(st);
    console.log('[EARNINGS_SERVICE_LABEL_FIX]', { sessionId: String(session.id || ''), serviceType: st, label });
  }

  return true;
}

/**
 * Enforce one normalized session shape for ALL sessions (old and new).
 * Runs on every read BEFORE any filtering.
 */
function normalizeSessionShape(session: any, userNameById: Map<string, string>, nowMs: number): { normalized: Session; changed: boolean } {
  const s: any = { ...(session as any) };
  let changed = false;

  // Normalize start/end times (and scheduled* aliases) first.
  normalizeSessionTimes(s);

  // Ensure canonical startTime/endTime exist as ISO strings.
  const startIso =
    toIsoStringOrNull(s.startTime) ||
    toIsoStringOrNull(s.scheduledStartTime) ||
    toIsoStringOrNull(s.scheduledStart) ||
    null;
  const endIso =
    toIsoStringOrNull(s.endTime) ||
    toIsoStringOrNull(s.scheduledEndTime) ||
    toIsoStringOrNull(s.scheduledEnd) ||
    null;

  // Hard fallbacks to avoid Invalid Date anywhere.
  const fallbackStart = new Date(nowMs).toISOString();
  const fallbackEnd = new Date(nowMs).toISOString();

  const finalStart = startIso || fallbackStart;
  const finalEnd = endIso || fallbackEnd;

  if (s.startTime !== finalStart) {
    s.startTime = finalStart;
    changed = true;
  }
  if (s.endTime !== finalEnd) {
    s.endTime = finalEnd;
    changed = true;
  }

  // Keep scheduled* coherent for legacy callers that still read them.
  if (!isNonEmptyString(s.scheduledStartTime) || !Number.isFinite(new Date(s.scheduledStartTime).getTime())) {
    s.scheduledStartTime = s.startTime;
    changed = true;
  }
  if (!isNonEmptyString(s.scheduledEndTime) || !Number.isFinite(new Date(s.scheduledEndTime).getTime())) {
    s.scheduledEndTime = s.endTime;
    changed = true;
  }
  if (!isNonEmptyString(s.scheduledStart) || !Number.isFinite(new Date(s.scheduledStart).getTime())) {
    s.scheduledStart = s.scheduledStartTime;
    changed = true;
  }
  if (!isNonEmptyString(s.scheduledEnd) || !Number.isFinite(new Date(s.scheduledEnd).getTime())) {
    s.scheduledEnd = s.scheduledEndTime;
    changed = true;
  }

  // Derive date from startTime (YYYY-MM-DD), never allow undefined/null.
  const derivedDate = isoDateFromIso(s.startTime) || (isIsoDateYYYYMMDD(s.date) ? s.date : null) || new Date(nowMs).toISOString().slice(0, 10);
  if (s.date !== derivedDate) {
    s.date = derivedDate;
    changed = true;
  }

  // Hydrate provider/student names if missing.
  const beforeProviderName = s.providerName;
  const beforeStudentName = s.studentName;
  hydrateParticipantNames(s, userNameById);
  if (beforeProviderName !== s.providerName || beforeStudentName !== s.studentName) {
    changed = true;
  }

  // Attendance/payout fields (canonical) - normalize to consistent shapes.
  const normalizedProviderJoinedAt = toIsoStringOrNull(s.providerJoinedAt);
  const normalizedStudentJoinedAt = toIsoStringOrNull(s.studentJoinedAt);
  if (s.providerJoinedAt !== normalizedProviderJoinedAt) {
    s.providerJoinedAt = normalizedProviderJoinedAt;
    changed = true;
  }
  if (s.studentJoinedAt !== normalizedStudentJoinedAt) {
    s.studentJoinedAt = normalizedStudentJoinedAt;
    changed = true;
  }

  if (typeof s.attendanceFlag !== 'string') {
    s.attendanceFlag = 'none';
    changed = true;
  }
  // IMPORTANT:
  // Do NOT default payout-eligibility fields to false when missing.
  // Many legacy/real sessions omit these fields entirely.
  // We now derive missing eligibility strictly from join evidence to prevent accidental payouts.

  // Backfill canonical attendance/payout for completed sessions if missing/legacy.
  if (String(s.status || '') === 'completed') {
    // If these fields are already explicitly set, never override them here.
    // When missing, treat a plain `status: "completed"` session as eligible by default.
    // (No-show/refund/cancel flows should explicitly set providerEarned/providerEligibleForPayout to false.)
    const explicitEarned = typeof (s as any).providerEarned === 'boolean' ? (s as any).providerEarned : null;
    const explicitEligible = typeof (s as any).providerEligibleForPayout === 'boolean' ? (s as any).providerEligibleForPayout : null;
    const explicitNoShow = typeof (s as any).flagNoShowProvider === 'boolean' ? (s as any).flagNoShowProvider : null;
    const noShowParty = String((s as any)?.noShowParty || '').trim().toLowerCase();
    const attendance = String((s as any)?.attendanceFlag || '').trim().toLowerCase();

    const joinedIso = String(s.providerJoinedAt || '').trim();
    const joinedMs = joinedIso ? new Date(joinedIso).getTime() : NaN;
    const hasProviderJoinEvidence = Number.isFinite(joinedMs);

    // Canonical payout eligibility:
    // Provider gets paid if they showed up (join evidence exists), regardless of student attendance.
    // Explicit "withheld" markers still win when present.
    const looksWithheld =
      explicitEarned === false ||
      explicitEligible === false ||
      explicitNoShow === true ||
      noShowParty === 'provider' ||
      noShowParty === 'both' ||
      attendance === 'provider_no_show' ||
      attendance === 'full_no_show';

    const canonicalEligible = looksWithheld ? false : hasProviderJoinEvidence;

    if (typeof (s as any).providerEligibleForPayout !== 'boolean') {
      (s as any).providerEligibleForPayout = canonicalEligible;
      changed = true;
    }
    if (typeof (s as any).providerEarned !== 'boolean') {
      (s as any).providerEarned = canonicalEligible;
      changed = true;
    }
    if (typeof (s as any).flagNoShowProvider !== 'boolean') {
      (s as any).flagNoShowProvider = !canonicalEligible;
      changed = true;
    }
    if (typeof (s as any).attendanceFlag !== 'string' || !(s as any).attendanceFlag) {
      (s as any).attendanceFlag = canonicalEligible ? 'none' : 'provider_no_show';
      changed = true;
    }
  }

  return { normalized: s as Session, changed };
}

/**
 * CENTRALIZED SERVER-SIDE SESSION NORMALIZATION (NO CRON)
 *
 * This runs on every session read to ensure we NEVER persist "upcoming" as a DB status.
 */
export async function getSessions(): Promise<Session[]> {
  const raw = await readSessionsRaw();
  const nowMs = Date.now();
  const nowISO = new Date(nowMs).toISOString();

  // STRICT BOOKING FLOW:
  // - Normalize status so paid sessions are persisted in the canonical lifecycle model.
  // - IMPORTANT: Do NOT delete unknown/legacy records from storage; keep them for visibility/debugging.
  let changed = false;
  const next: Session[] = [];

  for (const item of raw as any[]) {
    const { normalized: s, changed: shapeChanged } = normalizeSessionShape(item, new Map(), nowMs);
    let localChanged = shapeChanged;

    // Normalize/validate strict sessions where possible, but do NOT drop legacy/invalid records.
    const beforeStatus = typeof (s as any)?.status === 'string' ? String((s as any).status) : '';
    const beforeFlagNoShowStudent = Boolean((s as any)?.flagNoShowStudent);
    const isStrict = requireStrictPaidSessionFields(s as any, nowMs);
    const afterStatus = typeof (s as any)?.status === 'string' ? String((s as any).status) : '';
    if (beforeStatus !== afterStatus) localChanged = true;

    // FINAL AUTHORITATIVE RULE:
    // if (session.status === 'confirmed' && new Date() >= new Date(session.scheduledEnd)) {
    //   session.status = 'completed'
    //   session.completedAt = new Date().toISOString()
    // }
    const patch = resolveSessionStatusByTime(s as any, nowMs);
    if (patch && typeof (patch as any).status === 'string' && String((patch as any).status).trim()) {
      Object.assign(s as any, {
        ...patch,
        // Ensure timestamps are always set.
        completedAt:
          String((patch as any).status) === 'completed'
            ? (patch as any).completedAt || (s as any).completedAt || nowISO
            : (s as any).completedAt,
        updatedAt: (patch as any).updatedAt || nowISO,
      });
      localChanged = true;
    }

    // Transactional email triggers (no-show only) when we auto-resolve lifecycle.
    // - Provider no-show: status transitions into `provider_no_show`
    // - Student no-show: status transitions into `completed` with `flagNoShowStudent=true`
    try {
      const statusNow = typeof (s as any)?.status === 'string' ? String((s as any).status).trim() : '';
      const noShowPartyNow = typeof (s as any)?.noShowParty === 'string' ? String((s as any).noShowParty).trim().toLowerCase() : '';
      const flagNoShowStudentNow = Boolean((s as any)?.flagNoShowStudent);

      const transitionedToProviderNoShow = beforeStatus !== 'provider_no_show' && statusNow === 'provider_no_show';
      if (transitionedToProviderNoShow) {
        const alreadyStudent = Boolean((s as any)?.providerNoShowEmailStudentSentAt);
        const alreadyProvider = Boolean((s as any)?.providerNoShowEmailProviderSentAt);
        if (!alreadyStudent || !alreadyProvider) {
          const { sendNoShowEmailsForSession } = await import('@/lib/email/transactional');
          const sendResult = await sendNoShowEmailsForSession(s as any);
          const sentAt = new Date().toISOString();
          if (sendResult.studentEmailSent) (s as any).providerNoShowEmailStudentSentAt = sentAt;
          if (sendResult.providerEmailSent) (s as any).providerNoShowEmailProviderSentAt = sentAt;
          if (sendResult.studentEmailSent && sendResult.providerEmailSent) (s as any).providerNoShowEmailsSentAt = sentAt;
          (s as any).updatedAt = sentAt;
          localChanged = true;
        }
      }

      const becameStudentNoShow =
        !beforeFlagNoShowStudent &&
        flagNoShowStudentNow &&
        (noShowPartyNow === 'student' || statusNow === 'student_no_show');
      if (becameStudentNoShow) {
        const alreadyStudent = Boolean((s as any)?.studentNoShowEmailStudentSentAt);
        const alreadyProvider = Boolean((s as any)?.studentNoShowEmailProviderSentAt);
        if (!alreadyStudent || !alreadyProvider) {
          const { sendNoShowEmailsForSession } = await import('@/lib/email/transactional');
          const sendResult = await sendNoShowEmailsForSession(s as any);
          const sentAt = new Date().toISOString();
          if (sendResult.studentEmailSent) (s as any).studentNoShowEmailStudentSentAt = sentAt;
          if (sendResult.providerEmailSent) (s as any).studentNoShowEmailProviderSentAt = sentAt;
          if (sendResult.studentEmailSent && sendResult.providerEmailSent) (s as any).studentNoShowEmailsSentAt = sentAt;
          (s as any).updatedAt = sentAt;
          localChanged = true;
        }
      }
    } catch (e) {
      console.warn('[email] no-show email trigger failed (non-blocking)', {
        sessionId: String((s as any)?.id || ''),
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Keep legacy/invalid sessions as-is (normalized shape only). Strict validation is best-effort.
    void isStrict;
    next.push(s as Session);
    if (localChanged) changed = true;
  }

  // Persist only if we made safe canonicalizations (never shrink the dataset).
  if (changed) {
    await saveSessions(next);
  }

  return next;
}

// Write sessions to file
export async function saveSessions(sessions: Session[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const rows = (sessions || [])
    .filter(Boolean)
    .map((s: any) => {
      const id = String(s?.id || '').trim();
      const startIso = String(s?.startTime || s?.scheduledStartTime || s?.scheduledStart || '').trim();
      const endIso = String(s?.endTime || s?.scheduledEndTime || s?.scheduledEnd || '').trim();
      const datetime = startIso || nowIso;
      const providerJoinedAt = typeof s?.providerJoinedAt === 'string' && s.providerJoinedAt.trim() ? s.providerJoinedAt : null;
      const studentJoinedAt = typeof s?.studentJoinedAt === 'string' && s.studentJoinedAt.trim() ? s.studentJoinedAt : null;

      return {
        id,
        student_id: String(s?.studentId || '').trim(),
        provider_id: String(s?.providerId || '').trim(),
        datetime,
        end_datetime: endIso || null,
        status: String(s?.status || '').trim() || 'confirmed',
        // Mirror join evidence into queryable columns (source of truth remains `data.*JoinedAt`).
        provider_joined_at: providerJoinedAt,
        student_joined_at: studentJoinedAt,
        // Keep `data.id` consistent with the row id to avoid future drift.
        data: { ...(s || {}), id },
        created_at: String(s?.createdAt || nowIso),
        updated_at: String(s?.updatedAt || nowIso),
      };
    })
    .filter((r) => r.id && r.student_id && r.provider_id && r.datetime);

  if (rows.length === 0) return;

  const { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

// Find sessions by student ID
export async function getSessionsByStudentId(studentId: string): Promise<Session[]> {
  const sessions = await getSessions();
  return sessions.filter(session => session.studentId === studentId);
}

// Find sessions by provider ID
export async function getSessionsByProviderId(providerId: string): Promise<Session[]> {
  const sessions = await getSessions();
  return sessions.filter(session => session.providerId === providerId);
}

// Get session by ID
export async function getSessionById(id: string): Promise<Session | null> {
  const session = await readSessionByIdRaw(id);
  if (!session) return null;

  // Evaluate status on read (idempotent) so single-session fetches also auto-resolve
  // provider/student no-shows and join-evidence completion.
  const patch = resolveSessionStatusByTime(session, Date.now());
  if (patch && typeof (patch as any).status === 'string' && String((patch as any).status).trim()) {
    // Persist best-effort; lenient to avoid legacy shape blocking lifecycle transitions.
    await updateSessionLenient(String((session as any)?.id || id), patch);
    return { ...(session as any), ...(patch as any) } as Session;
  }

  return session;
}

export async function getSessionsForUser(
  userId: string,
  role: 'student' | 'provider'
): Promise<{ upcoming: Session[]; completed: Session[]; cancelled: Session[]; sessions: Session[] }> {
  const sessions = await getSessions();
  const nowMs = Date.now();

  const userSessions =
    role === 'student' ? sessions.filter((s) => s.studentId === userId) : sessions.filter((s) => s.providerId === userId);

  const getStartMs = (s: any): number => {
    const iso = s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  };
  const getEndMs = (s: any): number => {
    return getSessionEndTimeMs(s) ?? 0;
  };

  // CANONICAL BUCKETING (per CURRENT product spec):
  // - Upcoming: status === confirmed AND endTimeUTC > now
  // - Completed: status === completed
  // - Cancelled: status === cancelled
  const upcoming = (userSessions as any[])
    .filter((s) => isSessionUpcoming(s, nowMs) && s?.status !== 'cancelled')
    .sort((a, b) => getStartMs(a) - getStartMs(b)) as Session[];

  const completed = (userSessions as any[])
    .filter((s) => isSessionCompleted(s, nowMs) || s?.status === 'completed')
    .sort((a, b) => getEndMs(b) - getEndMs(a)) as Session[];

  const cancelled = (userSessions as any[])
    .filter((s) => s?.status === 'cancelled')
    .sort((a, b) => getEndMs(b) - getEndMs(a)) as Session[];

  // Return all sessions for callers that want a single list (do not drop unknown/legacy statuses).
  const allForUser = [...userSessions].sort((a, b) => getStartMs(a) - getStartMs(b));

  return { upcoming, completed, cancelled, sessions: allForUser };
}

function normalizeSessionTimes<T extends Record<string, any>>(session: T): T {
  // Prefer already-normalized ISO fields (either schema), then fall back to legacy variants.
  const pickIso = (...candidates: Array<string | undefined | null>): string | undefined => {
    for (const c of candidates) {
      if (!c) continue;
      const t = new Date(c).getTime();
      if (Number.isFinite(t)) return new Date(c).toISOString();
    }
    return undefined;
  };

  const s: any = session;

  // Legacy date + time-of-day support (per instructions)
  const looksLikeTimeOfDay = (v: unknown) =>
    typeof v === 'string' && v.includes(':') && !v.includes('T') && !v.includes('Z');

  const legacyStartFromDate =
    s.date && (looksLikeTimeOfDay(s.startTime) || looksLikeTimeOfDay(s.start))
      ? new Date(`${s.date}T${(looksLikeTimeOfDay(s.startTime) ? s.startTime : s.start)}`).toISOString()
      : undefined;
  const legacyEndFromDate =
    s.date && (looksLikeTimeOfDay(s.endTime) || looksLikeTimeOfDay(s.end))
      ? new Date(`${s.date}T${(looksLikeTimeOfDay(s.endTime) ? s.endTime : s.end)}`).toISOString()
      : undefined;

  const startIso = pickIso(
    s.startTime,
    s.scheduledStartTime,
    s.scheduledStart,
    legacyStartFromDate
  );
  const endIso = pickIso(
    s.endTime,
    s.scheduledEndTime,
    s.scheduledEnd,
    legacyEndFromDate
  );

  // Only attach if we successfully normalized.
  if (startIso) {
    s.startTime = startIso;
    const scheduledStartTimeValid = Number.isFinite(new Date(s.scheduledStartTime).getTime());
    const scheduledStartValid = Number.isFinite(new Date(s.scheduledStart).getTime());
    s.scheduledStartTime = !scheduledStartTimeValid ? startIso : s.scheduledStartTime;
    s.scheduledStart = !scheduledStartValid ? startIso : s.scheduledStart;
    s.scheduledStartTime = s.scheduledStartTime || startIso;
    s.scheduledStart = s.scheduledStart || s.scheduledStartTime || startIso;
  }
  if (endIso) {
    s.endTime = endIso;
    const scheduledEndTimeValid = Number.isFinite(new Date(s.scheduledEndTime).getTime());
    const scheduledEndValid = Number.isFinite(new Date(s.scheduledEnd).getTime());
    s.scheduledEndTime = !scheduledEndTimeValid ? endIso : s.scheduledEndTime;
    s.scheduledEnd = !scheduledEndValid ? endIso : s.scheduledEnd;
    s.scheduledEndTime = s.scheduledEndTime || endIso;
    s.scheduledEnd = s.scheduledEnd || s.scheduledEndTime || endIso;
  }

  return session;
}

// Create new session
export async function createSession(session: Omit<Session, 'createdAt' | 'updatedAt'>): Promise<Session> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const base: any = normalizeSessionTimes({
    ...(session as any),
    createdAt: (session as any)?.createdAt || nowIso,
    updatedAt: (session as any)?.updatedAt || nowIso,
  });

  // STRICT BOOKING FLOW: new paid sessions must start as `confirmed` (never `completed` / no-show / etc).
  if (String(base?.status || '').trim() !== 'confirmed') {
    throw new Error('Strict session creation rejected: status must be "confirmed"');
  }

  if (!requireStrictPaidSessionFields(base, nowMs)) {
    throw new Error('Strict session creation rejected: missing required fields');
  }

  // Prevent booking the same provider+time slot more than once (active sessions only)
  const startIso = String((base as any)?.startTime || (base as any)?.scheduledStartTime || (base as any)?.scheduledStart || '').trim();
  const endIso = String((base as any)?.endTime || (base as any)?.scheduledEndTime || (base as any)?.scheduledEnd || '').trim();
  if (!startIso || !endIso) {
    throw new Error('Strict session creation rejected: missing start/end time');
  }

  const supabase = getSupabaseAdmin();
  const { data: dupRows, error: dupErr } = await supabase
    .from('sessions')
    .select('id')
    .eq('provider_id', String((base as any).providerId))
    .eq('datetime', startIso)
    .eq('end_datetime', endIso)
    .neq('status', 'cancelled')
    .limit(1);
  if (dupErr) throw dupErr;
  if (Array.isArray(dupRows) && dupRows.length > 0) {
    throw new Error('Strict session creation rejected: slot already booked');
  }

  await saveSessions([base as Session]);
  return base as Session;
}

/**
 * Update a session by ID (patch semantics).
 * Used across API routes and resolvers.
 */
export async function updateSession(id: string, patch: Partial<Session>): Promise<boolean> {
  const existing = await readSessionByIdRaw(id);
  if (!existing) return false;
  const nowMs = Date.now();
  const nowISO = new Date(nowMs).toISOString();

  const mergedRaw: any = normalizeSessionTimes({
    ...(existing as any),
    ...(patch as any),
    updatedAt: (patch as any)?.updatedAt || nowISO,
  });

  // Keep storage strict: reject updates that would make a session invalid
  if (!requireStrictPaidSessionFields(mergedRaw, nowMs)) return false;

  // Transactional email trigger for manual no-show marking (idempotent).
  try {
    const beforeStatus = typeof (existing as any)?.status === 'string' ? String((existing as any).status).trim() : '';
    const afterStatus = typeof (mergedRaw as any)?.status === 'string' ? String((mergedRaw as any).status).trim() : '';
    const beforeFlagNoShowStudent = Boolean((existing as any)?.flagNoShowStudent);
    const afterFlagNoShowStudent = Boolean((mergedRaw as any)?.flagNoShowStudent);
    const afterNoShowParty = typeof (mergedRaw as any)?.noShowParty === 'string' ? String((mergedRaw as any).noShowParty).trim().toLowerCase() : '';

    const transitionedToProviderNoShow = beforeStatus !== 'provider_no_show' && afterStatus === 'provider_no_show';
    if (transitionedToProviderNoShow) {
      const alreadyStudent = Boolean((mergedRaw as any)?.providerNoShowEmailStudentSentAt);
      const alreadyProvider = Boolean((mergedRaw as any)?.providerNoShowEmailProviderSentAt);
      if (!alreadyStudent || !alreadyProvider) {
        const { sendNoShowEmailsForSession } = await import('@/lib/email/transactional');
        const sendResult = await sendNoShowEmailsForSession(mergedRaw as any);
        const sentAt = new Date().toISOString();
        if (sendResult.studentEmailSent) (mergedRaw as any).providerNoShowEmailStudentSentAt = sentAt;
        if (sendResult.providerEmailSent) (mergedRaw as any).providerNoShowEmailProviderSentAt = sentAt;
        if (sendResult.studentEmailSent && sendResult.providerEmailSent) (mergedRaw as any).providerNoShowEmailsSentAt = sentAt;
        (mergedRaw as any).updatedAt = sentAt;
      }
    }

    const becameStudentNoShow =
      !beforeFlagNoShowStudent &&
      afterFlagNoShowStudent &&
      (afterNoShowParty === 'student' || afterStatus === 'student_no_show');
    if (becameStudentNoShow) {
      const alreadyStudent = Boolean((mergedRaw as any)?.studentNoShowEmailStudentSentAt);
      const alreadyProvider = Boolean((mergedRaw as any)?.studentNoShowEmailProviderSentAt);
      if (!alreadyStudent || !alreadyProvider) {
        const { sendNoShowEmailsForSession } = await import('@/lib/email/transactional');
        const sendResult = await sendNoShowEmailsForSession(mergedRaw as any);
        const sentAt = new Date().toISOString();
        if (sendResult.studentEmailSent) (mergedRaw as any).studentNoShowEmailStudentSentAt = sentAt;
        if (sendResult.providerEmailSent) (mergedRaw as any).studentNoShowEmailProviderSentAt = sentAt;
        if (sendResult.studentEmailSent && sendResult.providerEmailSent) (mergedRaw as any).studentNoShowEmailsSentAt = sentAt;
        (mergedRaw as any).updatedAt = sentAt;
      }
    }
  } catch (e) {
    console.warn('[email] manual no-show email trigger failed (non-blocking)', {
      sessionId: String((existing as any)?.id || id),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await saveSessions([mergedRaw as any]);
  return true;
}

/**
 * Lenient update (for resolvers/earnings only): persist critical lifecycle fields even when a
 * legacy session record fails strict paid-session validation.
 *
 * This prevents sessions from "disappearing" (e.g., past confirmed sessions) by ensuring they
 * can still be transitioned to `completed` / `flagged` / `cancelled` and remain queryable.
 */
export async function updateSessionLenient(id: string, patch: Partial<Session>): Promise<boolean> {
  const existing = await readSessionByIdRaw(id);
  if (!existing) return false;
  const nowISO = new Date().toISOString();

  const mergedRaw: any = normalizeSessionTimes({
    ...existing,
    ...(patch as any),
    updatedAt: (patch as any)?.updatedAt || nowISO,
  });

  // Never persist forbidden transient statuses; keep canonical lifecycle only.
  const rawStatus = isNonEmptyString(mergedRaw?.status) ? String(mergedRaw.status).trim() : '';
  if (rawStatus) {
    const normalized = rawStatus.toLowerCase();
    if (
      normalized === 'upcoming' ||
      normalized === 'scheduled' ||
      normalized === 'paid' ||
      normalized === 'in_progress' ||
      normalized === 'in_progress_pending_join'
    ) {
      mergedRaw.status = 'confirmed';
    }
    if (normalized === 'flagged') {
      mergedRaw.status = 'confirmed';
    }
    // No-show statuses are canonical terminal outcomes (do NOT normalize away).
    if (normalized === 'no_show_provider' || normalized === 'expired_provider_no_show') {
      mergedRaw.status = 'provider_no_show';
    }
    if (normalized === 'no_show_student') {
      mergedRaw.status = 'student_no_show';
    }
    if (normalized === 'no_show_both') {
      // Preserve "both" outcome via noShowParty while using provider_no_show as the status.
      mergedRaw.status = 'provider_no_show';
      mergedRaw.noShowParty = 'both';
    }
    if (normalized === 'no-show') {
      mergedRaw.status = 'provider_no_show';
    }
    if (normalized === 'expired') {
      mergedRaw.status = 'confirmed';
    }
    if (normalized === 'requires_review') {
      mergedRaw.status = 'confirmed';
    }
    if (normalized === 'cancelled-late' || normalized === 'refunded') {
      mergedRaw.status = 'cancelled';
    }
  }

  // Transactional email trigger for no-show marking through lenient updates (idempotent).
  try {
    const beforeStatus = typeof (existing as any)?.status === 'string' ? String((existing as any).status).trim() : '';
    const afterStatus = typeof (mergedRaw as any)?.status === 'string' ? String((mergedRaw as any).status).trim() : '';
    const beforeFlagNoShowStudent = Boolean((existing as any)?.flagNoShowStudent);
    const afterFlagNoShowStudent = Boolean((mergedRaw as any)?.flagNoShowStudent);
    const afterNoShowParty = typeof (mergedRaw as any)?.noShowParty === 'string' ? String((mergedRaw as any).noShowParty).trim().toLowerCase() : '';

    const transitionedToProviderNoShow = beforeStatus !== 'provider_no_show' && afterStatus === 'provider_no_show';
    if (transitionedToProviderNoShow) {
      const alreadyStudent = Boolean((mergedRaw as any)?.providerNoShowEmailStudentSentAt);
      const alreadyProvider = Boolean((mergedRaw as any)?.providerNoShowEmailProviderSentAt);
      if (!alreadyStudent || !alreadyProvider) {
        const { sendNoShowEmailsForSession } = await import('@/lib/email/transactional');
        const sendResult = await sendNoShowEmailsForSession(mergedRaw as any);
        const sentAt = new Date().toISOString();
        if (sendResult.studentEmailSent) (mergedRaw as any).providerNoShowEmailStudentSentAt = sentAt;
        if (sendResult.providerEmailSent) (mergedRaw as any).providerNoShowEmailProviderSentAt = sentAt;
        if (sendResult.studentEmailSent && sendResult.providerEmailSent) (mergedRaw as any).providerNoShowEmailsSentAt = sentAt;
        (mergedRaw as any).updatedAt = sentAt;
      }
    }

    const becameStudentNoShow =
      !beforeFlagNoShowStudent &&
      afterFlagNoShowStudent &&
      (afterNoShowParty === 'student' || afterStatus === 'student_no_show');
    if (becameStudentNoShow) {
      const alreadyStudent = Boolean((mergedRaw as any)?.studentNoShowEmailStudentSentAt);
      const alreadyProvider = Boolean((mergedRaw as any)?.studentNoShowEmailProviderSentAt);
      if (!alreadyStudent || !alreadyProvider) {
        const { sendNoShowEmailsForSession } = await import('@/lib/email/transactional');
        const sendResult = await sendNoShowEmailsForSession(mergedRaw as any);
        const sentAt = new Date().toISOString();
        if (sendResult.studentEmailSent) (mergedRaw as any).studentNoShowEmailStudentSentAt = sentAt;
        if (sendResult.providerEmailSent) (mergedRaw as any).studentNoShowEmailProviderSentAt = sentAt;
        if (sendResult.studentEmailSent && sendResult.providerEmailSent) (mergedRaw as any).studentNoShowEmailsSentAt = sentAt;
        (mergedRaw as any).updatedAt = sentAt;
      }
    }
  } catch (e) {
    console.warn('[email] lenient no-show email trigger failed (non-blocking)', {
      sessionId: String((existing as any)?.id || id),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await saveSessions([mergedRaw as any]);
  return true;
}

// Cancel session
export async function cancelSession(
  id: string,
  cancelledBy: string,
  reason: CancellationReason,
  note?: string
): Promise<Session | null> {
  const session = await readSessionByIdRaw(id);
  if (!session) return null;

  const now = new Date();
  const startIso = (session as any).scheduledStartTime || (session as any).scheduledStart;
  const sessionStart = startIso ? new Date(startIso) : new Date(NaN);
  const hoursUntilStart = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  // STRICT status model: only "cancelled" (no variants)
  session.status = 'cancelled';
  session.cancelledAt = now.toISOString();
  session.cancelledBy = cancelledBy;
  session.cancellationReason = reason;
  session.cancellationNote = note;
  session.updatedAt = now.toISOString();

  // Backwards-compatible local var (used by earlier implementations/debugging)
  void hoursUntilStart;

  await saveSessions([session]);
  return session;
}

// Complete session
export async function completeSession(
  id: string,
  actualStartTime?: string,
  actualEndTime?: string
): Promise<Session | null> {
  const session = await readSessionByIdRaw(id);
  if (!session) return null;

  session.status = 'completed';
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const startIso = actualStartTime ? toIsoStringOrNull(actualStartTime) : null;
  const endIso = actualEndTime ? toIsoStringOrNull(actualEndTime) : null;

  if (startIso) session.actualStartTime = startIso;
  if (endIso) session.actualEndTime = endIso;

  // Enforce canonical times + date on completion.
  session.startTime = startIso || (session as any).startTime || (session as any).scheduledStartTime || (session as any).scheduledStart || nowIso;
  session.endTime = endIso || (session as any).endTime || (session as any).scheduledEndTime || (session as any).scheduledEnd || nowIso;
  session.date = isoDateFromIso(session.startTime ?? nowIso) || new Date(nowMs).toISOString().slice(0, 10);
  session.updatedAt = nowIso;

  await saveSessions([session]);
  return session;
}

// Get upcoming sessions for a user (student or provider)
export async function getUpcomingSessions(userId: string, role: 'student' | 'provider'): Promise<Session[]> {
  const { upcoming } = await getSessionsForUser(userId, role);
  return upcoming;
}

// Get completed sessions for a user (student or provider)
export async function getCompletedSessions(userId: string, role: 'student' | 'provider'): Promise<Session[]> {
  const { completed } = await getSessionsForUser(userId, role);
  return completed;
}

