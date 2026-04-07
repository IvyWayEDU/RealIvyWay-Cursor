"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessions = getSessions;
exports.saveSessions = saveSessions;
exports.getSessionsByStudentId = getSessionsByStudentId;
exports.getSessionsByProviderId = getSessionsByProviderId;
exports.getSessionById = getSessionById;
exports.getSessionsForUser = getSessionsForUser;
exports.createSession = createSession;
exports.updateSession = updateSession;
exports.updateSessionLenient = updateSessionLenient;
exports.cancelSession = cancelSession;
exports.completeSession = completeSession;
exports.getUpcomingSessions = getUpcomingSessions;
exports.getCompletedSessions = getCompletedSessions;
require("server-only");
const lifecycle_1 = require("@/lib/sessions/lifecycle");
const status_resolver_1 = require("@/lib/sessions/status-resolver");
const serviceLabel_1 = require("@/lib/earnings/serviceLabel");
const admin_server_1 = require("@/lib/supabase/admin.server");
// Read sessions from file
async function readSessionsRaw() {
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { data, error } = await supabase.from('sessions').select('data').order('datetime', { ascending: true });
    if (error) {
        console.error('[sessions.storage] Error reading sessions from Supabase:', error);
        return [];
    }
    return (data ?? []).map((row) => row?.data).filter(Boolean);
}
async function readSessionByIdRaw(id) {
    const sid = String(id || '').trim();
    if (!sid)
        return null;
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { data, error } = await supabase.from('sessions').select('data').eq('id', sid).maybeSingle();
    if (error)
        throw error;
    return data?.data || null;
}
function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}
function isIsoDateYYYYMMDD(v) {
    return isNonEmptyString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function toIsoStringOrNull(v) {
    if (v == null)
        return null;
    // Accept strings, numbers (timestamps), and Date-like objects.
    const d = v instanceof Date ? v : new Date(v);
    const t = d.getTime();
    if (!Number.isFinite(t))
        return null;
    return d.toISOString();
}
function isoDateFromIso(iso) {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t))
        return null;
    return new Date(iso).toISOString().slice(0, 10);
}
function buildUserNameById(users) {
    const m = new Map();
    for (const u of users) {
        if (!u?.id)
            continue;
        if (isNonEmptyString(u.name))
            m.set(u.id, u.name);
    }
    return m;
}
function isUnknownProviderName(v) {
    if (!isNonEmptyString(v))
        return true;
    return v.trim().toLowerCase() === 'unknown provider';
}
function extractUuidV4Candidates(input) {
    // Strict-ish UUID v4/v5 matcher (accepts 1-5 for version to avoid over-restricting old ids).
    const re = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
    const matches = input.match(re) || [];
    // Uniq (case-insensitive)
    const seen = new Set();
    const out = [];
    for (const m of matches) {
        const norm = m.toLowerCase();
        if (seen.has(norm))
            continue;
        seen.add(norm);
        out.push(m);
    }
    return out;
}
function buildProviderResolutionContext(users, reservedSlots) {
    const providerIds = new Set();
    const providerNameById = new Map();
    for (const u of users) {
        const id = u?.id;
        if (!isNonEmptyString(id))
            continue;
        const roles = u?.roles;
        if (Array.isArray(roles) && roles.includes('provider')) {
            providerIds.add(id);
            if (isNonEmptyString(u?.name))
                providerNameById.set(id, String(u.name));
        }
    }
    const providerList = Array.from(providerIds);
    const singleProviderId = providerList.length === 1 ? providerList[0] : null;
    const reservedProvidersByTime = new Map();
    for (const slot of reservedSlots || []) {
        const status = slot?.status ?? 'available';
        if (status !== 'reserved')
            continue;
        const pid = slot?.providerId;
        const start = toIsoStringOrNull(slot?.startTime);
        const end = toIsoStringOrNull(slot?.endTime);
        if (!isNonEmptyString(pid) || !start || !end)
            continue;
        const key = `${start}|${end}`;
        const set = reservedProvidersByTime.get(key) || new Set();
        set.add(pid);
        reservedProvidersByTime.set(key, set);
    }
    return { providerIds, providerNameById, singleProviderId, reservedProvidersByTime };
}
function looksLikeLegacyOrTestProviderRef(session) {
    const providerId = isNonEmptyString(session?.providerId) ? String(session.providerId) : '';
    if (!providerId)
        return true;
    // Obvious legacy/test id patterns seen in older seed data
    if (providerId.startsWith('provider-'))
        return true;
    if (/^\d+$/.test(providerId))
        return true;
    if (providerId.toLowerCase() === 'pending')
        return true;
    // Additional signal: older seed data used "pending" serviceTypeId/availabilityId and $0 amounts.
    const serviceTypeId = isNonEmptyString(session?.serviceTypeId) ? String(session.serviceTypeId) : '';
    const availabilityId = isNonEmptyString(session?.availabilityId) ? String(session.availabilityId) : '';
    const priceCents = Number(session?.priceCents);
    if ((serviceTypeId === 'pending' || availabilityId === 'pending') && (Number.isFinite(priceCents) ? priceCents === 0 : true)) {
        return true;
    }
    return false;
}
function normalizeProviderForReadOnly(session, ctx) {
    // Non-destructive: returns a patched copy when we can be certain; never mutates the input object.
    const s = session;
    const providerNameUnknown = isUnknownProviderName(s?.providerName);
    const providerIdRaw = isNonEmptyString(s?.providerId) ? String(s.providerId).trim() : '';
    const hasValidProviderId = providerIdRaw && ctx.providerIds.has(providerIdRaw);
    // Per requirements, only attempt resolution when providerName is missing/"Unknown Provider".
    if (!providerNameUnknown)
        return session;
    // 1) If providerId is already a real provider user id, only backfill the name.
    if (hasValidProviderId) {
        const name = ctx.providerNameById.get(providerIdRaw);
        if (isNonEmptyString(name) && name !== s.providerName) {
            return { ...session, providerName: name };
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
                    return { ...session, providerId: pid, providerName: name };
                }
                // Provider exists but no name in map; still safe to backfill id and keep existing name.
                return { ...session, providerId: pid };
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
                return { ...session, providerId: pid, providerName: name };
            }
            return { ...session, providerId: pid };
        }
    }
    // 4) Last resort (ONLY for legacy/test sessions): if exactly one provider user exists, backfill.
    if (ctx.singleProviderId && looksLikeLegacyOrTestProviderRef(s)) {
        const pid = ctx.singleProviderId;
        const name = ctx.providerNameById.get(pid);
        if (isNonEmptyString(name)) {
            return { ...session, providerId: pid, providerName: name };
        }
        return { ...session, providerId: pid };
    }
    // Ambiguous or cannot be proven safe.
    return session;
}
function hydrateParticipantNames(_session, _userNameById) {
    // STRICT BOOKING FLOW:
    // Do not hydrate names from the user DB at read-time. Sessions must persist embedded snapshots.
}
function requireStrictPaidSessionFields(session, nowMs) {
    // Required fields per spec (strict booking flow)
    // Canonical status: sessions created from paid bookings MUST be `confirmed`.
    // Historical statuses are normalized here to avoid persisting "upcoming" (forbidden).
    const rawStatus = isNonEmptyString(session?.status) ? String(session.status).trim() : '';
    if (rawStatus) {
        const normalized = rawStatus.toLowerCase();
        if (normalized === 'upcoming' ||
            normalized === 'scheduled' ||
            normalized === 'paid' ||
            normalized === 'in_progress' ||
            normalized === 'in_progress_pending_join') {
            session.status = 'confirmed';
        }
        if (normalized === 'flagged') {
            session.status = 'confirmed';
        }
        // Canonicalize legacy variants to the supported lifecycle model (best-effort, non-destructive).
        // We keep auxiliary metadata fields (e.g., refund amounts) intact; only the status label is normalized.
        if (normalized === 'provider_no_show' ||
            normalized === 'no_show_provider' ||
            normalized === 'no_show_student' ||
            normalized === 'no_show_both' ||
            normalized === 'student_no_show' ||
            normalized === 'no-show' ||
            normalized === 'expired_provider_no_show' ||
            normalized === 'expired') {
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
        const fallback = (isNonEmptyString(session?.serviceTypeId) ? String(session.serviceTypeId) : '') ||
            (isNonEmptyString(session?.sessionType) ? String(session.sessionType) : '');
        const v = fallback.trim().toLowerCase().replace(/-/g, '_');
        if (v)
            session.serviceType = v;
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
        if (!isNonEmptyString(session?.[k]))
            return false;
    }
    const st = String(session.serviceType).trim().toLowerCase().replace(/-/g, '_');
    session.serviceType = st;
    if (!['tutoring', 'college_counseling', 'virtual_tour', 'test_prep'].includes(st))
        return false;
    // Required status values
    if (!isNonEmptyString(session?.status))
        return false;
    // For newly created paid sessions we require confirmed.
    const allowedStatuses = new Set([
        'confirmed',
        'completed',
        'cancelled',
    ]);
    if (!allowedStatuses.has(session.status))
        return false;
    // start/end must be valid ISO and end > start
    const startIso = toIsoStringOrNull(session.startTime);
    const endIso = toIsoStringOrNull(session.endTime);
    if (!startIso || !endIso)
        return false;
    if (new Date(endIso).getTime() <= new Date(startIso).getTime())
        return false;
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
    const desiredSessionType = session.serviceType === 'tutoring'
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
        const label = (0, serviceLabel_1.getEarningsServiceLabel)(st);
        console.log('[EARNINGS_SERVICE_LABEL_FIX]', { sessionId: String(session.id || ''), serviceType: st, label });
    }
    return true;
}
/**
 * Enforce one normalized session shape for ALL sessions (old and new).
 * Runs on every read BEFORE any filtering.
 */
function normalizeSessionShape(session, userNameById, nowMs) {
    const s = { ...session };
    let changed = false;
    // Normalize start/end times (and scheduled* aliases) first.
    normalizeSessionTimes(s);
    // Ensure canonical startTime/endTime exist as ISO strings.
    const startIso = toIsoStringOrNull(s.startTime) ||
        toIsoStringOrNull(s.scheduledStartTime) ||
        toIsoStringOrNull(s.scheduledStart) ||
        null;
    const endIso = toIsoStringOrNull(s.endTime) ||
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
    // Many legacy/real sessions omit these fields entirely, and our earnings code treats
    // "missing" as eligible (only explicit false means withheld).
    //
    // Defaulting them to false would incorrectly withhold provider earnings and prevent
    // available balance from updating after completion.
    // Backfill canonical attendance/payout for completed sessions if missing/legacy.
    if (String(s.status || '') === 'completed') {
        // If these fields are already explicitly set, never override them here.
        // When missing, treat a plain `status: "completed"` session as eligible by default.
        // (No-show/refund/cancel flows should explicitly set providerEarned/providerEligibleForPayout to false.)
        const explicitEarned = typeof s.providerEarned === 'boolean' ? s.providerEarned : null;
        const explicitEligible = typeof s.providerEligibleForPayout === 'boolean' ? s.providerEligibleForPayout : null;
        const explicitNoShow = typeof s.flagNoShowProvider === 'boolean' ? s.flagNoShowProvider : null;
        const noShowParty = String(s?.noShowParty || '').trim().toLowerCase();
        const attendance = String(s?.attendanceFlag || '').trim().toLowerCase();
        const looksWithheld = explicitEarned === false ||
            explicitEligible === false ||
            explicitNoShow === true ||
            noShowParty === 'provider' ||
            noShowParty === 'both' ||
            attendance === 'provider_no_show' ||
            attendance === 'full_no_show';
        const canonicalEligible = looksWithheld ? false : true;
        if (typeof s.providerEligibleForPayout !== 'boolean') {
            s.providerEligibleForPayout = canonicalEligible;
            changed = true;
        }
        if (typeof s.providerEarned !== 'boolean') {
            s.providerEarned = canonicalEligible;
            changed = true;
        }
        if (typeof s.flagNoShowProvider !== 'boolean') {
            s.flagNoShowProvider = !canonicalEligible;
            changed = true;
        }
        if (typeof s.attendanceFlag !== 'string' || !s.attendanceFlag) {
            s.attendanceFlag = canonicalEligible ? 'none' : 'provider_no_show';
            changed = true;
        }
    }
    return { normalized: s, changed };
}
/**
 * CENTRALIZED SERVER-SIDE SESSION NORMALIZATION (NO CRON)
 *
 * This runs on every session read to ensure we NEVER persist "upcoming" as a DB status.
 */
async function getSessions() {
    const raw = await readSessionsRaw();
    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();
    // STRICT BOOKING FLOW:
    // - Normalize status so paid sessions are persisted in the canonical lifecycle model.
    // - IMPORTANT: Do NOT delete unknown/legacy records from storage; keep them for visibility/debugging.
    let changed = false;
    const next = [];
    for (const item of raw) {
        const { normalized: s, changed: shapeChanged } = normalizeSessionShape(item, new Map(), nowMs);
        let localChanged = shapeChanged;
        // Normalize/validate strict sessions where possible, but do NOT drop legacy/invalid records.
        const beforeStatus = typeof s?.status === 'string' ? String(s.status) : '';
        const isStrict = requireStrictPaidSessionFields(s, nowMs);
        const afterStatus = typeof s?.status === 'string' ? String(s.status) : '';
        if (beforeStatus !== afterStatus)
            localChanged = true;
        // FINAL AUTHORITATIVE RULE:
        // if (session.status === 'confirmed' && new Date() >= new Date(session.scheduledEnd)) {
        //   session.status = 'completed'
        //   session.completedAt = new Date().toISOString()
        // }
        const patch = (0, status_resolver_1.resolveSessionStatusByTime)(s, nowMs);
        if (patch && patch.status === 'completed') {
            Object.assign(s, {
                ...patch,
                // Ensure timestamps are always set.
                completedAt: patch.completedAt || s.completedAt || nowISO,
                updatedAt: patch.updatedAt || nowISO,
            });
            localChanged = true;
        }
        // Keep legacy/invalid sessions as-is (normalized shape only). Strict validation is best-effort.
        void isStrict;
        next.push(s);
        if (localChanged)
            changed = true;
    }
    // Persist only if we made safe canonicalizations (never shrink the dataset).
    if (changed) {
        await saveSessions(next);
    }
    return next;
}
// Write sessions to file
async function saveSessions(sessions) {
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const nowIso = new Date().toISOString();
    const rows = (sessions || [])
        .filter(Boolean)
        .map((s) => {
        const startIso = String(s?.startTime || s?.scheduledStartTime || s?.scheduledStart || '').trim();
        const endIso = String(s?.endTime || s?.scheduledEndTime || s?.scheduledEnd || '').trim();
        const datetime = startIso || nowIso;
        return {
            id: String(s?.id || '').trim(),
            student_id: String(s?.studentId || '').trim(),
            provider_id: String(s?.providerId || '').trim(),
            datetime,
            end_datetime: endIso || null,
            status: String(s?.status || '').trim() || 'confirmed',
            data: s,
            created_at: String(s?.createdAt || nowIso),
            updated_at: String(s?.updatedAt || nowIso),
        };
    })
        .filter((r) => r.id && r.student_id && r.provider_id && r.datetime);
    if (rows.length === 0)
        return;
    const { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'id' });
    if (error)
        throw error;
}
// Find sessions by student ID
async function getSessionsByStudentId(studentId) {
    const sessions = await getSessions();
    return sessions.filter(session => session.studentId === studentId);
}
// Find sessions by provider ID
async function getSessionsByProviderId(providerId) {
    const sessions = await getSessions();
    return sessions.filter(session => session.providerId === providerId);
}
// Get session by ID
async function getSessionById(id) {
    return await readSessionByIdRaw(id);
}
async function getSessionsForUser(userId, role) {
    const sessions = await getSessions();
    const nowMs = Date.now();
    const userSessions = role === 'student' ? sessions.filter((s) => s.studentId === userId) : sessions.filter((s) => s.providerId === userId);
    const getStartMs = (s) => {
        const iso = s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
        const t = iso ? new Date(iso).getTime() : NaN;
        return Number.isFinite(t) ? t : 0;
    };
    const getEndMs = (s) => {
        return (0, lifecycle_1.getSessionEndTimeMs)(s) ?? 0;
    };
    // CANONICAL BUCKETING (per CURRENT product spec):
    // - Upcoming: status === confirmed AND endTimeUTC > now
    // - Completed: status === completed
    // - Cancelled: status === cancelled
    const upcoming = userSessions
        .filter((s) => (0, lifecycle_1.isSessionUpcoming)(s, nowMs) && s?.status !== 'cancelled')
        .sort((a, b) => getStartMs(a) - getStartMs(b));
    const completed = userSessions
        .filter((s) => (0, lifecycle_1.isSessionCompleted)(s, nowMs) || s?.status === 'completed')
        .sort((a, b) => getEndMs(b) - getEndMs(a));
    const cancelled = userSessions
        .filter((s) => s?.status === 'cancelled')
        .sort((a, b) => getEndMs(b) - getEndMs(a));
    // Return all sessions for callers that want a single list (do not drop unknown/legacy statuses).
    const allForUser = [...userSessions].sort((a, b) => getStartMs(a) - getStartMs(b));
    return { upcoming, completed, cancelled, sessions: allForUser };
}
function normalizeSessionTimes(session) {
    // Prefer already-normalized ISO fields (either schema), then fall back to legacy variants.
    const pickIso = (...candidates) => {
        for (const c of candidates) {
            if (!c)
                continue;
            const t = new Date(c).getTime();
            if (Number.isFinite(t))
                return new Date(c).toISOString();
        }
        return undefined;
    };
    const s = session;
    // Legacy date + time-of-day support (per instructions)
    const looksLikeTimeOfDay = (v) => typeof v === 'string' && v.includes(':') && !v.includes('T') && !v.includes('Z');
    const legacyStartFromDate = s.date && (looksLikeTimeOfDay(s.startTime) || looksLikeTimeOfDay(s.start))
        ? new Date(`${s.date}T${(looksLikeTimeOfDay(s.startTime) ? s.startTime : s.start)}`).toISOString()
        : undefined;
    const legacyEndFromDate = s.date && (looksLikeTimeOfDay(s.endTime) || looksLikeTimeOfDay(s.end))
        ? new Date(`${s.date}T${(looksLikeTimeOfDay(s.endTime) ? s.endTime : s.end)}`).toISOString()
        : undefined;
    const startIso = pickIso(s.startTime, s.scheduledStartTime, s.scheduledStart, legacyStartFromDate);
    const endIso = pickIso(s.endTime, s.scheduledEndTime, s.scheduledEnd, legacyEndFromDate);
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
async function createSession(session) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const base = normalizeSessionTimes({
        ...session,
        createdAt: session?.createdAt || nowIso,
        updatedAt: session?.updatedAt || nowIso,
    });
    // STRICT BOOKING FLOW: new paid sessions must start as `confirmed` (never `completed` / no-show / etc).
    if (String(base?.status || '').trim() !== 'confirmed') {
        throw new Error('Strict session creation rejected: status must be "confirmed"');
    }
    if (!requireStrictPaidSessionFields(base, nowMs)) {
        throw new Error('Strict session creation rejected: missing required fields');
    }
    // Prevent booking the same provider+time slot more than once (active sessions only)
    const startIso = String(base?.startTime || base?.scheduledStartTime || base?.scheduledStart || '').trim();
    const endIso = String(base?.endTime || base?.scheduledEndTime || base?.scheduledEnd || '').trim();
    if (!startIso || !endIso) {
        throw new Error('Strict session creation rejected: missing start/end time');
    }
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { data: dupRows, error: dupErr } = await supabase
        .from('sessions')
        .select('id')
        .eq('provider_id', String(base.providerId))
        .eq('datetime', startIso)
        .eq('end_datetime', endIso)
        .neq('status', 'cancelled')
        .limit(1);
    if (dupErr)
        throw dupErr;
    if (Array.isArray(dupRows) && dupRows.length > 0) {
        throw new Error('Strict session creation rejected: slot already booked');
    }
    await saveSessions([base]);
    return base;
}
/**
 * Update a session by ID (patch semantics).
 * Used across API routes and resolvers.
 */
async function updateSession(id, patch) {
    const existing = await readSessionByIdRaw(id);
    if (!existing)
        return false;
    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();
    const mergedRaw = normalizeSessionTimes({
        ...existing,
        ...patch,
        updatedAt: patch?.updatedAt || nowISO,
    });
    // Keep storage strict: reject updates that would make a session invalid
    if (!requireStrictPaidSessionFields(mergedRaw, nowMs))
        return false;
    await saveSessions([mergedRaw]);
    return true;
}
/**
 * Lenient update (for resolvers/earnings only): persist critical lifecycle fields even when a
 * legacy session record fails strict paid-session validation.
 *
 * This prevents sessions from "disappearing" (e.g., past confirmed sessions) by ensuring they
 * can still be transitioned to `completed` / `flagged` / `cancelled` and remain queryable.
 */
async function updateSessionLenient(id, patch) {
    const existing = await readSessionByIdRaw(id);
    if (!existing)
        return false;
    const nowISO = new Date().toISOString();
    const mergedRaw = normalizeSessionTimes({
        ...existing,
        ...patch,
        updatedAt: patch?.updatedAt || nowISO,
    });
    // Never persist forbidden transient statuses; keep canonical lifecycle only.
    const rawStatus = isNonEmptyString(mergedRaw?.status) ? String(mergedRaw.status).trim() : '';
    if (rawStatus) {
        const normalized = rawStatus.toLowerCase();
        if (normalized === 'upcoming' ||
            normalized === 'scheduled' ||
            normalized === 'paid' ||
            normalized === 'in_progress' ||
            normalized === 'in_progress_pending_join') {
            mergedRaw.status = 'confirmed';
        }
        if (normalized === 'flagged') {
            mergedRaw.status = 'confirmed';
        }
        if (normalized === 'provider_no_show' ||
            normalized === 'no_show_provider' ||
            normalized === 'no_show_student' ||
            normalized === 'no_show_both' ||
            normalized === 'student_no_show' ||
            normalized === 'no-show' ||
            normalized === 'expired_provider_no_show' ||
            normalized === 'expired' ||
            normalized === 'requires_review') {
            mergedRaw.status = 'confirmed';
        }
        if (normalized === 'cancelled-late' || normalized === 'refunded') {
            mergedRaw.status = 'cancelled';
        }
    }
    await saveSessions([mergedRaw]);
    return true;
}
// Cancel session
async function cancelSession(id, cancelledBy, reason, note) {
    const session = await readSessionByIdRaw(id);
    if (!session)
        return null;
    const now = new Date();
    const startIso = session.scheduledStartTime || session.scheduledStart;
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
async function completeSession(id, actualStartTime, actualEndTime) {
    const session = await readSessionByIdRaw(id);
    if (!session)
        return null;
    session.status = 'completed';
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const startIso = actualStartTime ? toIsoStringOrNull(actualStartTime) : null;
    const endIso = actualEndTime ? toIsoStringOrNull(actualEndTime) : null;
    if (startIso)
        session.actualStartTime = startIso;
    if (endIso)
        session.actualEndTime = endIso;
    // Enforce canonical times + date on completion.
    session.startTime = startIso || session.startTime || session.scheduledStartTime || session.scheduledStart || nowIso;
    session.endTime = endIso || session.endTime || session.scheduledEndTime || session.scheduledEnd || nowIso;
    session.date = isoDateFromIso(session.startTime ?? nowIso) || new Date(nowMs).toISOString().slice(0, 10);
    session.updatedAt = nowIso;
    await saveSessions([session]);
    return session;
}
// Get upcoming sessions for a user (student or provider)
async function getUpcomingSessions(userId, role) {
    const { upcoming } = await getSessionsForUser(userId, role);
    return upcoming;
}
// Get completed sessions for a user (student or provider)
async function getCompletedSessions(userId, role) {
    const { completed } = await getSessionsForUser(userId, role);
    return completed;
}
