import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { normalizeServiceType } from '@/lib/availability/engine';
import { readReservedSlotsFile } from '@/lib/availability/store.server';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';
import { normalizeSubjectId } from '@/lib/models/subjects';
import { checkBookingRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting/index';
import { languageTutoringMatches } from '@/lib/models/languageTutoring';
import { getNYDateKey } from '@/lib/booking/nyDate';

function normalizeSubject(s: unknown): string | null {
  if (!s) return null;
  const val = String(s).toLowerCase().trim();

  if (val === 'math') return 'math';
  if (val === 'english') return 'english';
  if (val === 'science') return 'science';
  if (val === 'history') return 'history';
  if (val === 'languages') return 'languages';
  if (val === 'computer science') return 'computer_science';
  if (val === 'test prep') return 'test_prep';

  return null;
}

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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v || '').trim()).filter(Boolean);
}

function normalizeProviderLanguagesFromJson(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
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

    const cutoffUTC = new Date(Date.now() + LEAD_TIME_BUFFER_MINUTES * 60 * 1000);
    const cutoffISO = cutoffUTC.toISOString();

    // Provider matching must come from Supabase `providers` table (school + serviceType filters).
    const supabase = getSupabaseAdmin();

    const { data: providerRows, error: providerErr } = await supabase
      .from('providers')
      .select('id, data')
      .order('id', { ascending: true });
    if (providerErr) throw providerErr;

    const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');

    // Compatibility: subjects/languages often live on users.data (provider profile writes to user storage).
    const providerIds = uniqStrings((providerRows ?? []).map((r: any) => (typeof r?.id === 'string' ? r.id.trim() : '')));
    const userDataById = new Map<string, any>();
    if (providerIds.length > 0) {
      const { data: userRows, error: userErr } = await supabase.from('users').select('id, data').in('id', providerIds as any);
      if (userErr) throw userErr;
      for (const row of userRows ?? []) {
        const id = typeof (row as any)?.id === 'string' ? String((row as any).id).trim() : '';
        const data = (row as any)?.data && typeof (row as any).data === 'object' ? (row as any).data : null;
        if (id && data) userDataById.set(id, data);
      }
    }

    const requestedSchoolId = String(schoolId || '').trim();
    const requestedSchoolName = String(schoolName || '').trim();
    const requestedLanguageRaw = String(language || '').trim();

    const providersAll = (providerRows ?? [])
      .map((r: any) => {
        const id = typeof r?.id === 'string' ? r.id.trim() : '';
        const data = r?.data && typeof r.data === 'object' ? r.data : {};
        const userData = userDataById.get(id) && typeof userDataById.get(id) === 'object' ? userDataById.get(id) : {};
        if (!id) return null;

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
        const providerLanguages = uniqStrings([
          ...normalizeProviderLanguagesFromJson((data as any)?.languages),
          ...normalizeProviderLanguagesFromJson((userData as any)?.languages),
          ...normalizeProviderLanguagesFromJson((userData as any)?.tutoringLanguages),
        ]);

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

        const providerSchoolName = schoolNames.length > 0 ? String(schoolNames[0] || '').trim() || null : null;

        return {
          id,
          providerId: id,
          providerName,
          providerSchoolName,
          profile_image_url,
          avatar,
          data,
          userData,
          schoolIds,
          schoolNames,
          services,
          offersVirtualTours,
          languages: providerLanguages,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      providerId: string;
      providerName: string;
      providerSchoolName: string | null;
      profile_image_url: string | null;
      avatar: string | null;
      data: any;
      userData: any;
      schoolIds: string[];
      schoolNames: string[];
      services: string[];
      offersVirtualTours: boolean;
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

    const explicitProviderId = String(providerId || '').trim();

    // Language tutoring is special-case: require a concrete language match.
    const subjectKeyRaw = String(selectedSubjectsRaw?.[0] || subject || '').trim();
    const selectedSubject =
      normalizedServiceType === 'test_prep' ? 'test_prep' : normalizeSubject(subjectKeyRaw);

    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep') && !selectedSubject) {
      return NextResponse.json({ error: `Unrecognized subject: "${subjectKeyRaw || subject || ''}"` }, { status: 400 });
    }

    const shouldApplyLanguageFilter =
      !explicitProviderId && normalizedServiceType === 'tutoring' && selectedSubject === 'languages';

    const providersAfterServiceSchool = providerCandidates;
    const providersAfterLanguage =
      shouldApplyLanguageFilter && requestedLanguageRaw
        ? providersAfterServiceSchool.filter(
            (p) =>
              Array.isArray((p as any).languages) &&
              (p as any).languages.some((l: any) => languageTutoringMatches(String(l ?? ''), requestedLanguageRaw))
          )
        : shouldApplyLanguageFilter
          ? []
          : providersAfterServiceSchool;

    const eligibleProviderIds =
      normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep'
        ? providersAfterLanguage
            .filter((p) => {
              // SINGLE SOURCE OF TRUTH:
              // Subjects must come ONLY from providers.data.subjects (no specialties, no users.data, no fallbacks).
              const rawSubjects = (p as any).data?.subjects;

              // HARD REQUIREMENT:
              // If provider.data.subjects is missing/null/empty array -> exclude provider completely.
              if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) return false;

              const subjects = (rawSubjects as any[])
                .map(normalizeSubject)
                .filter(Boolean) as string[];

              return !!selectedSubject && subjects.includes(selectedSubject);
            })
            .map((p) => p.providerId)
        : providersAfterLanguage.map((p) => p.providerId);

    console.log('[FINAL_SUBJECT_FIX]', {
      selectedSubject,
      providers: providersAfterLanguage.map((p) => ({
        id: p.id,
        subjects: (p as any).data?.subjects,
      })),
      eligibleProviderIds,
    });

    if (selectedSubject === 'math' && eligibleProviderIds.length === 0) {
      return NextResponse.json(
        { slots: [], nextAvailableSlots: [], providers: [], noSchoolMatch },
        { status: 200, headers: rateHeaders }
      );
    }

    const idsToQuery = explicitProviderId ? eligibleProviderIds.filter((id) => id === explicitProviderId) : eligibleProviderIds;
    if (idsToQuery.length === 0) {
      return NextResponse.json(
        { slots: [], nextAvailableSlots: [], providers: [], noSchoolMatch },
        { status: 200, headers: rateHeaders }
      );
    }

    // FIX 1: Fetch slots with strict provider filter at DB query level.
    // SELECT * FROM availability_slots WHERE provider_id = ANY(eligibleProviderIds) AND service_type = selectedService AND is_booked = false;
    const rows: any[] = [];
    for (const batch of chunkArray(idsToQuery, 200)) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .in('provider_id', batch)
        .eq('service_type', availabilityServiceType)
        .eq('is_booked', false)
        .order('start_time', { ascending: true });
      if (error) throw error;
      for (const r of data ?? []) rows.push(r as any);
    }

    const slots = (rows ?? [])
      .map((r: any) => {
        const provider_id = String(r?.provider_id || '').trim();
        const start_time = typeof r?.start_time === 'string' ? r.start_time : '';
        const end_time = typeof r?.end_time === 'string' ? r.end_time : '';
        if (!provider_id || !start_time || !end_time) return null;
        return { ...r, provider_id, start_time, end_time };
      })
      .filter(Boolean) as any[];

    const selectedDateInput = String(date || '').trim();
    const selectedDate = selectedDateInput;
    const selectedDateKey = getNYDateKey(selectedDate);

    // Remove lead-time slots after fetch (still within the strict provider/service dataset).
    const slotsAfterLeadTime = slots.filter((slot) => {
      const startMs = new Date(slot.start_time).getTime();
      if (!Number.isFinite(startMs)) return false;
      return startMs > new Date(cutoffISO).getTime();
    });

    // Remove reserved slots + overlapping booked sessions defensively (applies across the full fetched slot range).
    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .filter((s) => (s.status ?? 'available') === 'reserved')
        .map((s) => `${String((s as any)?.providerId || '').trim()}|${String((s as any)?.startTime || '').trim()}|${String((s as any)?.endTime || '').trim()}`)
        .filter((k) => k.split('|').every(Boolean))
    );

    const providerIdsForWindows = Array.from(new Set(slotsAfterLeadTime.map((s: any) => String(s?.provider_id || '').trim()).filter(Boolean)));
    const times = slotsAfterLeadTime
      .map((s: any) => {
        const ms = new Date(s?.start_time).getTime();
        return Number.isFinite(ms) ? ms : NaN;
      })
      .filter((ms: any) => Number.isFinite(ms)) as number[];
    const rangeStartISO = times.length > 0 ? new Date(Math.min(...times) - 2 * 60 * 60 * 1000).toISOString() : cutoffISO;
    const rangeEndISO = times.length > 0 ? new Date(Math.max(...times) + 2 * 60 * 60 * 1000).toISOString() : cutoffISO;

    const bookedWindows = await getBookedSessionWindowsForProviders({
      providerIds: providerIdsForWindows,
      rangeStartISO,
      rangeEndISO,
      defaultDurationMinutesWhenMissingEnd: 60,
    });
    const windowsByProvider = new Map<string, Array<{ sessionStartMs: number; sessionEndMs: number }>>();
    for (const w of bookedWindows || []) {
      const arr = windowsByProvider.get(w.providerId) || [];
      arr.push({ sessionStartMs: w.sessionStartMs, sessionEndMs: w.sessionEndMs });
      windowsByProvider.set(w.providerId, arr);
    }

    const allSlots = slotsAfterLeadTime
      .map((r: any) => {
        const providerId = String(r?.provider_id || '').trim();
        const startTimeUTC = new Date(r?.start_time).toISOString();
        const endTimeUTC = new Date(r?.end_time).toISOString();
        if (!providerId) return null;

        const reservationKey = `${providerId}|${startTimeUTC}|${endTimeUTC}`;
        if (reservedSet.has(reservationKey)) return null;

        const startMs = new Date(startTimeUTC).getTime();
        const endMs = new Date(endTimeUTC).getTime();
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

        const windows = windowsByProvider.get(providerId) || [];
        if (windows.length > 0 && overlapsAnyWindow(startMs, endMs, windows)) return null;

        return { providerId, startTimeUTC, endTimeUTC };
      })
      .filter(Boolean) as Array<{ providerId: string; startTimeUTC: string; endTimeUTC: string }>;

    // Filter by date in booking timezone (America/New_York) to avoid UTC/local mismatches.
    const filteredSlots = allSlots.filter((slot) => getNYDateKey(slot.startTimeUTC) === selectedDateKey);

    console.log('[DATE_DEBUG]', {
      selectedDate,
      selectedDateKey,
      slotTimes: slots.slice(0, 10).map((s: any) => ({
        raw: s.start_time,
        ny: getNYDateKey(s.start_time),
      })),
    });

    // TIME-FIRST: return unique times (not provider-specific) so the user selects time first.
    const uniqByTime = new Map<string, { startTimeUTC: string; endTimeUTC: string }>();
    for (const s of filteredSlots) {
      const key = `${s.startTimeUTC}|${s.endTimeUTC}`;
      if (!uniqByTime.has(key)) uniqByTime.set(key, { startTimeUTC: s.startTimeUTC, endTimeUTC: s.endTimeUTC });
    }
    const slotsOut = Array.from(uniqByTime.values()).sort(
      (a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime()
    );

    // FIX 3: Next available must use the SAME filtered dataset (no separate query).
    const nextAvailable = [...allSlots]
      .filter((slot) => idsToQuery.includes(slot.providerId))
      .filter((slot) => getNYDateKey(slot.startTimeUTC) !== selectedDateKey)
      .sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime());

    const nextAvailableStrict = nextAvailable.slice(0, 9);
    const nextAvailableSlots = nextAvailableStrict.map((s) => ({ startTimeUTC: s.startTimeUTC, endTimeUTC: s.endTimeUTC }));

    const nextAvailableProviderIds = uniqStrings(nextAvailableStrict.map((s) => s.providerId));
    const shownProviderIds = eligibleProviderIds.filter((id) => nextAvailableProviderIds.includes(id));
    console.log('[NEXT_AVAILABLE_STRICT]', {
      selectedSubject,
      eligibleProviderIds,
      nextAvailableProviderIds,
      shownProviderIds,
    });

    // Keep `providers` for backward compatibility, but booking UI no longer uses it.
    return NextResponse.json(
      { slots: slotsOut, nextAvailableSlots, providers: [], noSchoolMatch },
      { status: 200, headers: rateHeaders }
    );
  } catch (error) {
    console.error('[TIME_SLOTS_LOAD_ERROR]', error);
    return NextResponse.json({ error: String((error as any)?.message || error) }, { status: 500 });
  }
}

