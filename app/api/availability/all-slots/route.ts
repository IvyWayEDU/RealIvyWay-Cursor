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

    const cutoffUTC = new Date(Date.now() + LEAD_TIME_BUFFER_MINUTES * 60 * 1000);
    const cutoffISO = cutoffUTC.toISOString();

    // Provider matching must come from Supabase `providers` table (school + serviceType filters).
    const supabase = getSupabaseAdmin();

    // Providers must be sourced from real DB-backed `providers.subjects` (TEXT[] array).
    // If subjects is NULL or a string -> provider is NOT eligible for booking.
    const { data: providerRows, error: providerErr } = await supabase
      .from('providers')
      .select('id, data, subjects')
      .order('id', { ascending: true });
    if (providerErr) throw providerErr;

    const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');

    const requestedSchoolId = String(schoolId || '').trim();
    const requestedSchoolName = String(schoolName || '').trim();
    const requestedLanguageRaw = String(language || '').trim();

    const providersAll = (providerRows ?? [])
      .map((r: any) => {
        const id = typeof r?.id === 'string' ? r.id.trim() : '';
        const data = r?.data && typeof r.data === 'object' ? r.data : {};
        const subjects = (r as any)?.subjects;
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
        const providerLanguages = Array.from(new Set(normalizeStringArray((data as any)?.languages)));

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
          schoolIds,
          schoolNames,
          services,
          offersVirtualTours,
          subjects,
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
      schoolIds: string[];
      schoolNames: string[];
      services: string[];
      offersVirtualTours: boolean;
      subjects: unknown;
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

    const explicitProviderId = String(providerId || '').trim();

    // Language tutoring is special-case: require a concrete language match.
    const subjectKeyRaw = String(selectedSubjectsRaw?.[0] || subject || '').trim();
    const subjectKey =
      normalizedServiceType === 'test_prep'
        ? 'test_prep'
        : normalizeSubjectId(subjectKeyRaw) || subjectKeyRaw;

    const shouldApplyLanguageFilter =
      !explicitProviderId && normalizedServiceType === 'tutoring' && String(subjectKey || '').trim().toLowerCase() === 'languages';

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

    // FIX 2: Build eligibleProviderIds ONLY from DB-backed subjects[] (must be an array).
    const providersForEligibility = providersAfterLanguage.map((p) => ({
      id: p.providerId,
      subjects: (p as any).subjects,
    }));

    console.log('ALL PROVIDERS', providersForEligibility);

    const eligibleProviderIds = providersForEligibility
      .filter(
        (p) =>
          Array.isArray(p.subjects) &&
          (p.subjects as any[]).length > 0 &&
          (subjectKey ? (p.subjects as any[]).includes(subjectKey) : true)
      )
      .map((p) => p.id);

    console.log('ELIGIBLE IDS', eligibleProviderIds);

    const idsToQuery = explicitProviderId ? eligibleProviderIds.filter((id) => id === explicitProviderId) : eligibleProviderIds;
    if (idsToQuery.length === 0) {
      return NextResponse.json(
        { slots: [], nextAvailableSlots: [], providers: [], noSchoolMatch: false },
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

    console.log('ALL SLOTS', slots);

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

    // FIX 1: Filter by date in backend (NOT frontend).
    const selectedDate = new Date(String(date || '').trim());
    const filteredSlots = allSlots.filter((slot) => {
      const slotDate = new Date(slot.startTimeUTC);
      return slotDate.toDateString() === selectedDate.toDateString();
    });

    console.log('FILTERED SLOTS', filteredSlots);

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
      .filter((slot) => eligibleProviderIds.includes(slot.providerId))
      .filter((slot) => new Date(slot.startTimeUTC).toDateString() !== selectedDate.toDateString())
      .sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime());

    const nextAvailableSlots = nextAvailable.slice(0, 9).map((s) => ({ startTimeUTC: s.startTimeUTC, endTimeUTC: s.endTimeUTC }));

    // Keep `providers` for backward compatibility, but booking UI no longer uses it.
    return NextResponse.json(
      { slots: slotsOut, nextAvailableSlots, providers: [], noSchoolMatch },
      { status: 200, headers: rateHeaders }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/all-slots]' });
  }
}

