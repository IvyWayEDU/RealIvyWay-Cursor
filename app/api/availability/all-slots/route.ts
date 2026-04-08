import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { normalizeServiceType } from '@/lib/availability/engine';
import { readReservedSlotsFile } from '@/lib/availability/store.server';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';
import { subjectsMatch } from '@/lib/models/subjects';
import { normalizeSubjectId } from '@/lib/models/subjects';
import { checkBookingRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting/index';

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  serviceType: z.string(),
  subject: z.string().optional(),
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
      schoolId: url.searchParams.get('schoolId') || undefined,
      schoolName: url.searchParams.get('schoolName') || undefined,
      durationMinutes: url.searchParams.get('durationMinutes') || undefined,
      providerId: url.searchParams.get('providerId') || undefined,
      debugOnlyProviderFilter: url.searchParams.get('debugOnlyProviderFilter') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues?.[0]?.message || 'Invalid query' }, { status: 400 });
    }

    const { date, serviceType, subject, schoolId, schoolName, providerId, debugOnlyProviderFilter } = parsed.data;

    const normalizedServiceType = normalizeServiceType(serviceType);
    // Booking rule: virtual tours reuse college counseling availability; test prep reuses tutoring.
    const availabilityServiceType =
      normalizedServiceType === 'virtual_tour'
        ? 'college_counseling'
        : normalizedServiceType === 'test_prep'
          ? 'tutoring'
          : normalizedServiceType;

    // Normalize serviceType(s) for inventory querying (DB service_type values)
    let normalizedServiceTypes: string[] = [];

    if (Array.isArray(serviceType)) {
      normalizedServiceTypes = serviceType.map((s) => (s === 'test_prep' ? 'tutoring' : s));
    } else {
      normalizedServiceTypes = [serviceType === 'test_prep' ? 'tutoring' : serviceType];
    }

    normalizedServiceTypes = Array.from(
      new Set(
        normalizedServiceTypes.map((st) => {
          const canonical = normalizeServiceType(st);
          if (canonical === 'virtual_tour') return 'college_counseling';
          if (canonical === 'test_prep') return 'tutoring';
          return canonical;
        })
      )
    );

    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep') && !subject) {
      return NextResponse.json({ error: 'subject is required for tutoring and test prep services' }, { status: 400 });
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

    // Date filtering fix: enforce DATE(start_time) = date (UTC date).
    // Enforce filtering within the selected UTC day boundaries.
    // IMPORTANT: do not mix local-time setters (setHours) with UTC setters (setUTCHours).
    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log("[TIME_FILTER]", {
      selectedDate,
      startOfDay,
      endOfDay
    });

    const rangeStartISO = startOfDay.toISOString();
    const rangeEndISO = endOfDay.toISOString();

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

    const { data: providerRows, error: providersErr } = await supabase
      .from('providers')
      .select('id, data')
      .order('id', { ascending: true });
    if (providersErr) throw providersErr;

    const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');

    const requestedSchoolId = String(schoolId || '').trim();
    const requestedSchoolName = String(schoolName || '').trim();

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

    const providersAll = (providerRows ?? [])
      .map((r: any) => {
        const id = typeof r?.id === 'string' ? r.id.trim() : '';
        const data = r?.data && typeof r.data === 'object' ? r.data : {};
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

        const canonicalSubjects = Array.from(
          new Set(
            [
              ...(subjectsByProviderId.get(id) || []),
              ...normalizeStringArray((data as any)?.subjects),
              ...normalizeStringArray((data as any)?.specialties),
            ]
              .map((s) => normalizeSubjectId(String(s ?? '').trim()))
              .filter((s): s is string => !!s)
          )
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
          subjects: canonicalSubjects,
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
    // Resolve providerIds from `providers.subjects` (array) and/or `provider_subjects` table.
    const requestedSubjectRaw = String(subject || '').trim();
    const requestedSubjectKey = requestedSubjectRaw ? normalizeSubjectId(requestedSubjectRaw) : null;
    let subjectProviderIds: string[] | null = null;
    if (requestedSubjectKey && (normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep')) {
      const idSet = new Set<string>();

      // Source 1: `providers.subjects` (array column). This may not exist in older schemas.
      try {
        const { data: subjectRows, error: subjectErr } = await supabase
          .from('providers')
          .select('id, subjects')
          .contains('subjects', [requestedSubjectKey]);
        if (subjectErr) throw subjectErr;
        for (const r of subjectRows ?? []) {
          const id = typeof (r as any)?.id === 'string' ? String((r as any).id).trim() : '';
          if (id) idSet.add(id);
        }
      } catch {
        // Ignore (schema may not have providers.subjects yet).
      }

      // Source 2: `provider_subjects` join table. This may not exist in older schemas.
      try {
        const { data: joinRows, error: joinErr } = await supabase
          .from('provider_subjects')
          .select('provider_id')
          .eq('subject', requestedSubjectKey);
        if (joinErr) throw joinErr;
        for (const r of joinRows ?? []) {
          const id = typeof (r as any)?.provider_id === 'string' ? String((r as any).provider_id).trim() : '';
          if (id) idSet.add(id);
        }
      } catch {
        // Ignore (schema may not have provider_subjects yet).
      }

      // Fallback: existing JSON subjects/specialties in providers.data (keeps old data working).
      if (idSet.size === 0) {
        for (const p of providersAll) {
          if (!Array.isArray(p.subjects) || p.subjects.length === 0) continue;
          if (p.subjects.some((ps) => subjectsMatch(ps, requestedSubjectKey))) {
            idSet.add(p.providerId);
          }
        }
      }

      subjectProviderIds = Array.from(idSet);
    }

    const subjectProviderIdSet = subjectProviderIds ? new Set(subjectProviderIds) : null;
    const matchesSubjectIfNeeded = (p: (typeof providersAll)[number]) => {
      if (!(normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep')) return true;
      if (!requestedSubjectKey) return false;
      if (!subjectProviderIdSet) return true;
      return subjectProviderIdSet.has(p.providerId);
    };

    const baseCandidates = providersAll.filter(matchesServiceType).filter(matchesSubjectIfNeeded);

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
    const providerIds = explicitProviderId
      ? [explicitProviderId]
      : uniqStrings(providerCandidates.map((p) => p.providerId));

    if (requestedSubjectKey && (normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep')) {
      console.log('[SUBJECT_FILTER]', { subject: requestedSubjectKey, providerIds });
    }

    if (providerIds.length === 0) {
      return NextResponse.json({ slots: [], providers: [], noSchoolMatch: false }, { status: 200, headers: rateHeaders });
    }

    const rows: Array<{ provider_id: string; start_time: string; end_time: string }> = [];

    console.log("[AVAILABILITY_FETCH]", { serviceType, providerId: explicitProviderId || null });

    if (explicitProviderId) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('provider_id, start_time, end_time')
        .eq('provider_id', explicitProviderId)
        .eq('is_booked', false)
        .in('service_type', normalizedServiceTypes.length > 0 ? normalizedServiceTypes : [availabilityServiceType])
        .gte('start_time', rangeStartISO)
        .lte('start_time', rangeEndISO)
        .gt('start_time', cutoffISO)
        .order('start_time', { ascending: true });
      if (error) throw error;
      for (const r of data ?? []) rows.push(r as any);
    } else {
      for (const batch of chunkArray(providerIds, 200)) {
        const { data, error } = await supabase
          .from('availability_slots')
          .select('provider_id, start_time, end_time')
          .in('provider_id', batch)
          .eq('is_booked', false)
          .in('service_type', normalizedServiceTypes.length > 0 ? normalizedServiceTypes : [availabilityServiceType])
          .gte('start_time', rangeStartISO)
          .lte('start_time', rangeEndISO)
          .gt('start_time', cutoffISO)
          .order('start_time', { ascending: true });
        if (error) throw error;
        for (const r of data ?? []) rows.push(r as any);
      }
    }

    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .filter((s) => s.startTime >= rangeStartISO && s.startTime <= rangeEndISO)
        .map((s) => `${s.providerId}|${s.startTime}|${s.endTime}`)
    );

    const bookedWindows = await getBookedSessionWindowsForProviders({
      providerIds,
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

    // TIME-FIRST: return unique times (not provider-specific) so the user selects time first.
    const uniqByTime = new Map<string, { startTimeUTC: string; endTimeUTC: string }>();
    for (const s of slotsWithProviders) {
      const key = `${s.startTimeUTC}|${s.endTimeUTC}`;
      if (!uniqByTime.has(key)) uniqByTime.set(key, { startTimeUTC: s.startTimeUTC, endTimeUTC: s.endTimeUTC });
    }
    const slots = Array.from(uniqByTime.values());

    // Keep `providers` for backward compatibility, but booking UI no longer uses it.
    return NextResponse.json({ slots, providers: [], noSchoolMatch }, { status: 200, headers: rateHeaders });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/all-slots]' });
  }
}

