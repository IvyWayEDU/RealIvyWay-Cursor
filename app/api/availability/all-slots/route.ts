import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { normalizeServiceType } from '@/lib/availability/engine';
import { readReservedSlotsFile } from '@/lib/availability/store.server';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';
import { subjectsMatch } from '@/lib/models/subjects';
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

function schoolMatches(params: {
  providerSchoolIds: string[];
  providerSchoolNames: string[];
  requestedSchoolId?: string;
  requestedSchoolName?: string;
}): boolean {
  const requestedSchoolId = String(params.requestedSchoolId || '').trim();
  const requestedSchoolName = String(params.requestedSchoolName || '').trim();
  if (!requestedSchoolId && !requestedSchoolName) return true;

  if (requestedSchoolId) {
    return params.providerSchoolIds.some((id) => String(id || '').trim() === requestedSchoolId);
  }

  const target = requestedSchoolName.toLowerCase();
  return params.providerSchoolNames.some((n) => String(n || '').trim().toLowerCase() === target);
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
    // In Supabase/Postgres (UTC), this is equivalent to [dateT00:00Z, nextDateT00:00Z).
    const dayStartUTC = new Date(`${date}T00:00:00.000Z`);
    const dayEndUTC = new Date(dayStartUTC);
    dayEndUTC.setUTCDate(dayEndUTC.getUTCDate() + 1);
    const rangeStartISO = dayStartUTC.toISOString();
    const rangeEndISO = dayEndUTC.toISOString();

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

    const providersAll = (providerRows ?? [])
      .map((r: any) => {
        const id = typeof r?.id === 'string' ? r.id.trim() : '';
        const data = r?.data && typeof r.data === 'object' ? r.data : {};
        if (!id) return null;

        const servicesRaw: unknown = (data as any)?.services;
        const services = Array.isArray(servicesRaw) ? servicesRaw.map(norm).filter(Boolean) : [];

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

        const subjects = Array.from(
          new Set(
            [
              ...normalizeStringArray((data as any)?.subjects),
              ...normalizeStringArray((data as any)?.specialties),
            ].filter(Boolean)
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
          subjects,
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
        // Test prep inventory uses tutoring slots, but provider must still offer test prep (or tutoring if you model it that way).
        return p.services.includes('test_prep') || p.services.includes('tutoring');
      }
      return p.services.includes(normalizedServiceType);
    };

    const matchesSubjectIfNeeded = (p: (typeof providersAll)[number]) => {
      if (!(normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep')) return true;
      if (!subject) return false;
      const providerSubjects = p.subjects;
      if (!Array.isArray(providerSubjects) || providerSubjects.length === 0) return false;
      return providerSubjects.some((ps) => subjectsMatch(ps, subject));
    };

    const providerCandidates = providersAll
      .filter(matchesServiceType)
      .filter(matchesSchoolStrict)
      .filter(matchesSubjectIfNeeded);

    const providerIds = providerCandidates.map((p) => p.providerId).filter(Boolean);

    if (providerIds.length === 0) {
      return NextResponse.json({ slots: [], providers: [] }, { status: 200, headers: rateHeaders });
    }

    const rows: Array<{ provider_id: string; start_time: string; end_time: string }> = [];

    for (const batch of chunkArray(providerIds, 200)) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('provider_id, start_time, end_time')
        .in('provider_id', batch)
        .eq('is_booked', false)
        .eq('service_type', availabilityServiceType)
        .gte('start_time', rangeStartISO)
        .lt('start_time', rangeEndISO)
        .gt('start_time', cutoffISO)
        .order('start_time', { ascending: true });
      if (error) throw error;
      for (const r of data ?? []) rows.push(r as any);
    }

    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .filter((s) => s.startTime >= rangeStartISO && s.startTime < rangeEndISO)
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

    const slots = rows
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

    const providers =
      normalizedServiceType === 'college_counseling' || normalizedServiceType === 'virtual_tour'
        ? providerCandidates
            .map((p) => {
              const matchesRequestedSchool = schoolMatches({
                providerSchoolIds: p.schoolIds,
                providerSchoolNames: p.schoolNames,
                requestedSchoolId: schoolId,
                requestedSchoolName: schoolName,
              });
              return {
                providerId: p.providerId,
                providerName: p.providerName,
                providerSchoolName: p.providerSchoolName,
                profile_image_url: p.profile_image_url,
                avatar: p.avatar,
                matchesRequestedSchool,
              };
            })
            .sort((a, b) => Number(b.matchesRequestedSchool) - Number(a.matchesRequestedSchool))
        : [];

    return NextResponse.json({ slots, providers }, { status: 200, headers: rateHeaders });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/all-slots]' });
  }
}

