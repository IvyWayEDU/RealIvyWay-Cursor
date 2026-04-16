import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { normalizeServiceType } from '@/lib/availability/engine';
import { readReservedSlotsFile } from '@/lib/availability/store.server';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';
import { normalizeSubjectId } from '@/lib/models/subjects';
import { checkBookingRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting/index';
import { languageTutoringMatches } from '@/lib/models/languageTutoring';

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  serviceType: z.string(),
  subject: z.string().optional(),
  language: z.string().optional(),
  schoolId: z.string().optional(),
  schoolName: z.string().optional(),
  durationMinutes: z.string().optional(),
  providerId: z.string().optional(),
  debugOnlyProviderFilter: z.string().optional(),
});

// Business rule: all sessions must be booked at least 60 minutes in advance.
const LEAD_TIME_BUFFER_MINUTES = 60;

function parseIsoDateYYYYMMDDToUtcDate(dateKey: string): Date {
  const [yRaw, mRaw, dRaw] = String(dateKey || '').trim().split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date('invalid');
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v || '').trim()).filter(Boolean);
}

function uniqStrings(input: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of input) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function overlapsAnyWindow(
  slotStartMs: number,
  slotEndMs: number,
  windows: Array<{ sessionStartMs: number; sessionEndMs: number }>
): boolean {
  for (const w of windows) {
    if (slotStartMs < w.sessionEndMs && slotEndMs > w.sessionStartMs) return true;
  }
  return false;
}

function canonicalSubjectToEligibilityLabel(subject: string): string {
  const canonical = normalizeSubjectId(String(subject ?? '').trim()) || String(subject ?? '').trim();
  if (canonical === 'math') return 'Math';
  if (canonical === 'english') return 'English';
  if (canonical === 'computer_science') return 'Computer Science';
  if (canonical === 'languages') return 'Languages';
  if (canonical === 'test_prep') return 'Test Prep';
  return canonical;
}

function subjectsToEligibilityLabels(subjects: unknown): string[] {
  const raw = Array.isArray(subjects) ? subjects : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    const canonical = normalizeSubjectId(typeof s === 'string' ? s : String(s ?? '')) || String(s ?? '').trim();
    if (!canonical) continue;
    const display = canonicalSubjectToEligibilityLabel(canonical);
    for (const v of [display, canonical]) {
      const vv = String(v || '').trim();
      if (!vv || seen.has(vv)) continue;
      seen.add(vv);
      out.push(vv);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      date: url.searchParams.get('date'),
      serviceType: url.searchParams.get('serviceType'),
      subject: url.searchParams.get('subject') || undefined,
      language: url.searchParams.get('language') || undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      schoolName: url.searchParams.get('schoolName') || undefined,
      durationMinutes: url.searchParams.get('durationMinutes') || undefined,
      providerId: url.searchParams.get('providerId') || undefined,
      debugOnlyProviderFilter: url.searchParams.get('debugOnlyProviderFilter') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues?.[0]?.message || 'Invalid query' }, { status: 400 });
    }

    const { date, serviceType, subject, language, schoolId, schoolName, providerId, debugOnlyProviderFilter } = parsed.data;

    const normalizedServiceType = normalizeServiceType(serviceType);
    // Booking rule: virtual tours reuse college counseling availability; test prep reuses tutoring.
    const availabilityServiceType =
      normalizedServiceType === 'virtual_tour'
        ? 'college_counseling'
        : normalizedServiceType === 'test_prep'
          ? 'tutoring'
          : normalizedServiceType;

    // Tutoring requires subject selection; Test Prep is a service UX that maps to tutoring + subject=test_prep.
    const rawSubjectParams = url.searchParams.getAll('subject').map((s) => String(s || '').trim()).filter(Boolean);
    const selectedSubjectsRaw =
      rawSubjectParams.length > 0 ? rawSubjectParams : subject ? [String(subject || '').trim()].filter(Boolean) : [];
    if (normalizedServiceType === 'tutoring' && selectedSubjectsRaw.length === 0) {
      return NextResponse.json({ error: 'subject is required for tutoring services' }, { status: 400 });
    }

    // RATE LIMITING: Booking/Payment rate limit (prevent rapid-fire availability queries)
    const rateLimitResult = checkBookingRateLimit(req, session.userId, '/api/availability/all-slots');
    const rateHeaders = createRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before querying availability again.' },
        { status: 429, headers: rateHeaders }
      );
    }

    // Strict date filtering:
    // Interpret the selected YYYY-MM-DD as a UTC day and query ONLY by UTC bounds.
    // Do not use local time comparisons or timezone-based re-filtering.
    const selectedDate = date;
    const startOfDay = parseIsoDateYYYYMMDDToUtcDate(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = parseIsoDateYYYYMMDDToUtcDate(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const rangeStartISO = startOfDay.toISOString();
    const rangeEndISO = endOfDay.toISOString();
    const queryStartISO = rangeStartISO;
    const queryEndISO = rangeEndISO;

    const cutoffUTC = new Date(Date.now() + LEAD_TIME_BUFFER_MINUTES * 60 * 1000);
    const cutoffISO = cutoffUTC.toISOString();

    // Provider matching must come from Supabase `providers` table (school + serviceType filters).
    const supabase = getSupabaseAdmin();

    // DEBUG: Temporarily remove ALL filters except provider_id (requires providerId).
    // This returns ALL slots for that provider (including other dates/service types/is_booked).
    if (debugOnlyProviderFilter === '1') {
      const pid = String(providerId || '').trim();
      if (!pid) {
        return NextResponse.json(
          { error: 'providerId is required when debugOnlyProviderFilter=1' },
          { status: 400, headers: rateHeaders }
        );
      }

      const { data: debugRows, error: debugErr } = await supabase
        .from('availability_slots')
        .select('provider_id, start_time, end_time')
        .eq('provider_id', pid)
        .order('start_time', { ascending: true });
      if (debugErr) throw debugErr;

      const slots = (debugRows ?? []).map((r: any) => ({
        providerId: String(r?.provider_id || '').trim(),
        startTimeUTC: new Date(r?.start_time).toISOString(),
        endTimeUTC: new Date(r?.end_time).toISOString(),
      }));

      return NextResponse.json({ slots, providers: [] }, { status: 200, headers: rateHeaders });
    }

    // Providers table shape differs across environments. Prefer `user_id` when available for subject fallback.
    let providerRows: any[] = [];
    {
      const attempt = await supabase.from('providers').select('id, user_id, data').order('id', { ascending: true });
      if (!attempt.error) {
        providerRows = attempt.data ?? [];
      } else {
        const fallback = await supabase.from('providers').select('id, data').order('id', { ascending: true });
        if (fallback.error) throw fallback.error;
        providerRows = fallback.data ?? [];
      }
    }

    const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');

    const requestedSchoolId = String(schoolId || '').trim();
    const requestedSchoolName = String(schoolName || '').trim();
    const requestedLanguageRaw = String(language || '').trim();

    // Optional: load provider subjects from a dedicated column when present.
    // Kept in a separate query so older schemas (without providers.subjects) don't 500.
    const subjectsByProviderId = new Map<string, string[]>();
    try {
      const { data: subjectRows, error: subjectErr } = await supabase
        .from('providers')
        .select('id, subjects')
        .order('id', { ascending: true });
      if (subjectErr) throw subjectErr;
      for (const r of subjectRows ?? []) {
        const id = typeof (r as any)?.id === 'string' ? String((r as any).id).trim() : '';
        const subj = (r as any)?.subjects;
        if (!id || !Array.isArray(subj)) continue;
        subjectsByProviderId.set(
          id,
          Array.from(
            new Set(
              subj
                .map((s: any) => normalizeSubjectId(typeof s === 'string' ? s : String(s ?? '')))
                .filter((s: any): s is string => !!s)
            )
          )
        );
      }
    } catch {
      // Ignore: column does not exist yet.
    }

    // Fallback: some environments store provider subjects only on the related `users.data.subjects`.
    // Pull those too (best-effort) so availability matching doesn't depend on providers.data being up to date.
    const subjectsByUserId = new Map<string, string[]>();
    const languagesByUserId = new Map<string, string[]>();
    try {
      const userIds = Array.from(
        new Set(
          (providerRows ?? [])
            .map((r: any) => (typeof r?.user_id === 'string' ? String(r.user_id).trim() : ''))
            .filter(Boolean)
        )
      );
      if (userIds.length > 0) {
        const { data: userRows, error: userErr } = await supabase.from('users').select('id, data').in('id', userIds);
        if (userErr) throw userErr;
        for (const r of userRows ?? []) {
          const id = typeof (r as any)?.id === 'string' ? String((r as any).id).trim() : '';
          const data = (r as any)?.data && typeof (r as any).data === 'object' ? (r as any).data : {};
          const subj = Array.isArray((data as any)?.subjects) ? (data as any).subjects : [];
          const langs = Array.isArray((data as any)?.languages) ? (data as any).languages : [];
          if (!id) continue;
          subjectsByUserId.set(
            id,
            Array.from(
              new Set(
                subj
                  .map((s: any) => normalizeSubjectId(typeof s === 'string' ? s : String(s ?? '')))
                  .filter((s: any): s is string => !!s)
              )
            )
          );
          languagesByUserId.set(
            id,
            Array.from(new Set(langs.map((s: any) => String(s ?? '').trim()).filter(Boolean)))
          );
        }
      }
    } catch {
      // Ignore: not all environments have `user_id` or `users.data.subjects` populated.
    }

    const providersAll = (providerRows ?? [])
      .map((r: any) => {
        const id = typeof r?.id === 'string' ? r.id.trim() : '';
        const data = r?.data && typeof r.data === 'object' ? r.data : {};
        if (!id) return null;
        const userId = typeof (r as any)?.user_id === 'string' ? String((r as any).user_id).trim() : '';

        const servicesRaw: unknown = (data as any)?.services;
        const services = Array.isArray(servicesRaw)
          ? servicesRaw
              .map(norm)
              .map((s) => (s === 'test_prep' || s === 'testprep' ? 'tutoring' : s))
              .filter(Boolean)
          : [];

        const schoolIds = Array.from(
          new Set(
            [
              ...normalizeStringArray((data as any)?.schoolIds),
              typeof (data as any)?.schoolId === 'string' ? String((data as any).schoolId).trim() : '',
              typeof (data as any)?.school_id === 'string' ? String((data as any).school_id).trim() : '',
            ].filter(Boolean)
          )
        );

        const schoolNames = Array.from(
          new Set(
            [
              ...normalizeStringArray((data as any)?.schoolNames),
              typeof (data as any)?.school === 'string' ? String((data as any).school).trim() : '',
              typeof (data as any)?.school_name === 'string' ? String((data as any).school_name).trim() : '',
            ].filter(Boolean)
          )
        );

        const offersVirtualTours = (data as any)?.offersVirtualTours === true || services.includes('virtual_tour');

        // SUBJECT AUTHORITY RULE:
        // Prefer provider-owned sources (providers.subjects column, providers.data.subjects/specialties).
        // Fall back to users.data.subjects ONLY when provider-owned sources are empty.
        const subjectsPrimaryRaw = [
          ...(subjectsByProviderId.get(id) || []),
          ...normalizeStringArray((data as any)?.subjects),
          ...normalizeStringArray((data as any)?.specialties),
        ];
        const subjectsFallbackRaw = userId ? subjectsByUserId.get(userId) || [] : [];

        const canonicalSubjectsPrimary = Array.from(
          new Set(
            subjectsPrimaryRaw
              .map((s) => normalizeSubjectId(String(s ?? '').trim()))
              .filter((s): s is string => !!s)
          )
        );
        const canonicalSubjectsFallback = Array.from(
          new Set(
            subjectsFallbackRaw
              .map((s) => normalizeSubjectId(String(s ?? '').trim()))
              .filter((s): s is string => !!s)
          )
        );
        const canonicalSubjects =
          canonicalSubjectsPrimary.length > 0 ? canonicalSubjectsPrimary : canonicalSubjectsFallback;

        // Language authority: prefer providers.data.languages; fall back to users.data.languages when missing.
        const languagesPrimary = normalizeStringArray((data as any)?.languages);
        const languagesFallback = userId ? languagesByUserId.get(userId) || [] : [];
        const providerLanguages = Array.from(
          new Set((languagesPrimary.length > 0 ? languagesPrimary : languagesFallback).map((s) => String(s ?? '').trim()).filter(Boolean))
        );

        const providerName =
          typeof (data as any)?.displayName === 'string' && String((data as any).displayName).trim()
            ? String((data as any).displayName).trim()
            : 'Provider';

        const profile_image_url =
          typeof (data as any)?.profile_image_url === 'string' && String((data as any).profile_image_url).trim()
            ? String((data as any).profile_image_url).trim()
            : null;

        const avatar =
          typeof (data as any)?.avatar === 'string' && String((data as any).avatar).trim()
            ? String((data as any).avatar).trim()
            : null;

        const providerSchoolName =
          schoolNames.length > 0 ? String(schoolNames[0] || '').trim() || null : null;

        return {
          id,
          providerId: id,
          providerName,
          providerSchoolName,
          profile_image_url,
          avatar,
          schoolIds,
          schoolNames,
          services,
          offersVirtualTours,
          subjects: Array.isArray(canonicalSubjects) ? canonicalSubjects : [],
          languages: providerLanguages,
        };
      })
      .filter(Boolean) as Array<{
      providerId: string;
      providerName: string;
      providerSchoolName: string | null;
      profile_image_url: string | null;
      avatar: string | null;
      schoolIds: string[];
      schoolNames: string[];
      services: string[];
      offersVirtualTours: boolean;
      subjects: string[];
      languages: string[];
    }>;

    const matchesSchoolStrict = (p: (typeof providersAll)[number]) => {
      // If no school is provided, don't filter.
      if (!requestedSchoolId && !requestedSchoolName) return true;
      if (requestedSchoolId) {
        return p.schoolIds.some((id) => String(id || '').trim() === requestedSchoolId);
      }
      const target = requestedSchoolName.toLowerCase();
      return p.schoolNames.some((n) => String(n || '').trim().toLowerCase() === target);
    };

    const matchesServiceType = (p: (typeof providersAll)[number]) => {
      // Service filtering is strict: provider must offer the requested service (or an allowed equivalent).
      if (normalizedServiceType === 'virtual_tour') {
        return p.offersVirtualTours === true || p.services.includes('virtual_tour');
      }
      if (normalizedServiceType === 'college_counseling') {
        return (
          p.services.includes('college_counseling') ||
          p.services.includes('counseling') ||
          p.offersVirtualTours === true
        );
      }
      if (normalizedServiceType === 'tutoring') {
        return p.services.includes('tutoring');
      }
      if (normalizedServiceType === 'test_prep') {
        // Consistency rule: Test Prep is a SUBJECT under tutoring, not a provider service.
        return p.services.includes('tutoring');
      }
      return p.services.includes(normalizedServiceType);
    };

    // Subject filtering must be provider-based (NOT availability_slots.subject).
    // Match providers by intersecting normalized selected subject keys with provider.subjects[].
    const normalizeSubject = (s: unknown): string => String(s || '').trim().toLowerCase().replace(/\s+/g, '_');
    const normalizedSelectedSubjects =
      normalizedServiceType === 'test_prep'
        ? ['test_prep']
        : selectedSubjectsRaw
            .map((s) => normalizeSubjectId(s) || normalizeSubject(s))
            .map((s) => String(s || '').trim())
            .filter(Boolean);

    const baseCandidates = providersAll.filter(matchesServiceType);

    let noSchoolMatch = false;
    let providerCandidates = baseCandidates;

    // School filtering fallback:
    // - If a school is requested AND there are providers at that school, show ONLY those providers.
    // - If a school is requested AND there are NO providers at that school, DO NOT return empty results.
    //   Instead, fall back to ALL providers offering the service (and subject, if applicable).
    if (requestedSchoolId || requestedSchoolName) {
      const schoolMatched = baseCandidates.filter(matchesSchoolStrict);
      if (schoolMatched.length > 0) {
        providerCandidates = schoolMatched;
        noSchoolMatch = false;
      } else {
        providerCandidates = baseCandidates;
        noSchoolMatch = true;
      }
    }

    const matchingProviders =
      normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep'
        ? providerCandidates.filter((provider) => {
            const subjects = Array.isArray((provider as any).subjects) ? (provider as any).subjects : [];
            return subjects.some((sub: any) => normalizedSelectedSubjects.includes(String(sub || '').toLowerCase()));
          })
        : providerCandidates;

    // SUBJECT FIX: compute eligible providers BEFORE any availability query.
    // We keep canonical matching elsewhere, but this explicit gate ensures subject eligibility never widens.
    const selectedSubjectRaw = String(selectedSubjectsRaw?.[0] || subject || '').trim();
    const selectedSubject = selectedSubjectRaw ? canonicalSubjectToEligibilityLabel(selectedSubjectRaw) : '';
    const providers = providerCandidates.map((p) => ({
      id: p.providerId,
      subjects: subjectsToEligibilityLabels((p as any).subjects),
    }));
    const eligibleProviderIds = selectedSubject
      ? providers
          .filter((p) => {
            if (selectedSubject === 'Math') return p.subjects.includes('Math') || p.subjects.includes('math');
            if (selectedSubject === 'English') return p.subjects.includes('English') || p.subjects.includes('english');
            if (selectedSubject === 'Computer Science')
              return p.subjects.includes('Computer Science') || p.subjects.includes('computer_science');
            if (selectedSubject === 'Languages') return true; // handled separately
            if (selectedSubject === 'Test Prep') return p.subjects.includes('Test Prep') || p.subjects.includes('test_prep');
            return false;
          })
          .map((p) => p.id)
      : providers.map((p) => p.id);

    const eligibleProviderIdSet = new Set(eligibleProviderIds);

    const explicitProviderId = String(providerId || '').trim();
    const shouldApplyLanguageFilter =
      !explicitProviderId &&
      normalizedServiceType === 'tutoring' &&
      normalizedSelectedSubjects.some((s) => String(s || '').trim().toLowerCase() === 'languages');

    const languageFilteredProviders = shouldApplyLanguageFilter
      ? requestedLanguageRaw
        ? matchingProviders.filter((p) => Array.isArray((p as any).languages) && (p as any).languages.some((l: any) => languageTutoringMatches(String(l ?? ''), requestedLanguageRaw)))
        : []
      : matchingProviders;

    const providerIdsPreEligibility = explicitProviderId
      ? [explicitProviderId]
      : uniqStrings(languageFilteredProviders.map((p) => p.providerId));
    const providerIds = providerIdsPreEligibility.filter((pid) => eligibleProviderIdSet.has(pid));

    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep') && normalizedSelectedSubjects.length > 0) {
      console.log('[SUBJECT_FILTER]', { subjects: normalizedSelectedSubjects, providerIds });
    }

    if (providerIds.length === 0) {
      console.log('[SUBJECT_FIX]', { selectedSubject, eligibleProviderIds, shownProviders: [] });
      return NextResponse.json({ slots: [], providers: [], noSchoolMatch: false }, { status: 200, headers: rateHeaders });
    }

    const rows: Array<{ provider_id: string; start_time: string; end_time: string }> = [];

    console.log("[AVAILABILITY_FETCH]", { serviceType, providerId: explicitProviderId || null });

    for (const batch of chunkArray(providerIds, 200)) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('provider_id, start_time, end_time')
        .in('provider_id', batch)
        .eq('is_booked', false)
        .eq('service_type', availabilityServiceType)
        .gte('start_time', queryStartISO)
        .lte('start_time', queryEndISO)
        .gt('start_time', cutoffISO)
        .order('start_time', { ascending: true });
      if (error) throw error;
      for (const r of data ?? []) rows.push(r as any);
    }

    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .filter((s) => s.startTime >= rangeStartISO && s.startTime <= rangeEndISO)
        .map((s) => `${s.providerId}|${s.startTime}|${s.endTime}`)
    );

    const bookedWindows = await getBookedSessionWindowsForProviders({
      providerIds,
      rangeStartISO: queryStartISO,
      rangeEndISO: queryEndISO,
      defaultDurationMinutesWhenMissingEnd: 60,
    });
    const windowsByProvider = new Map<string, Array<{ sessionStartMs: number; sessionEndMs: number }>>();
    for (const w of bookedWindows || []) {
      const arr = windowsByProvider.get(w.providerId) || [];
      arr.push({ sessionStartMs: w.sessionStartMs, sessionEndMs: w.sessionEndMs });
      windowsByProvider.set(w.providerId, arr);
    }

    const slotsWithProviders = rows
      .map((r) => {
        const providerId = String((r as any)?.provider_id || '').trim();
        const startTimeUTC = new Date((r as any)?.start_time).toISOString();
        const endTimeUTC = new Date((r as any)?.end_time).toISOString();
        if (!providerId) return null;

        const key = `${providerId}|${startTimeUTC}|${endTimeUTC}`;
        if (reservedSet.has(key)) return null;

        const startMs = new Date(startTimeUTC).getTime();
        const endMs = new Date(endTimeUTC).getTime();
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

        const windows = windowsByProvider.get(providerId) || [];
        if (windows.length > 0 && overlapsAnyWindow(startMs, endMs, windows)) return null;

        return { providerId, startTimeUTC, endTimeUTC };
      })
      .filter(Boolean) as Array<{ providerId: string; startTimeUTC: string; endTimeUTC: string }>;

    const shownProviders = Array.from(new Set(slotsWithProviders.map((s) => s.providerId))).filter(Boolean);
    console.log('[SUBJECT_FIX]', { selectedSubject, eligibleProviderIds, shownProviders });

    // TIME-FIRST: return unique times (not provider-specific) so the user selects time first.
    const uniqByTime = new Map<string, { startTimeUTC: string; endTimeUTC: string }>();
    for (const s of slotsWithProviders) {
      const key = `${s.startTimeUTC}|${s.endTimeUTC}`;
      if (!uniqByTime.has(key)) uniqByTime.set(key, { startTimeUTC: s.startTimeUTC, endTimeUTC: s.endTimeUTC });
    }
    const slots = Array.from(uniqByTime.values());

    const slotsSorted = [...slots].sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime());
    console.log('[SLOT_RANGE_DEBUG]', {
      providerId: explicitProviderId || null,
      serviceType: normalizedServiceType,
      selectedDate,
      firstSlot: slotsSorted[0] || null,
      lastSlot: slotsSorted[slotsSorted.length - 1] || null,
      slotCount: slotsSorted.length,
    });

    console.log('[DATE_FIX]', {
      selectedDate,
      startOfDay,
      endOfDay,
      slotsFound: slotsSorted.length,
    });

    // Keep `providers` for backward compatibility, but booking UI no longer uses it.
    return NextResponse.json({ slots, providers: [], noSchoolMatch }, { status: 200, headers: rateHeaders });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/all-slots]' });
  }
}

