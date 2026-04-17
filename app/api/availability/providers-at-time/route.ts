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
import { languageTutoringMatches } from '@/lib/models/languageTutoring';

function uniqStrings(arr: string[]) {
  return Array.from(new Set(arr));
}

const QuerySchema = z.object({
  startTimeUTC: z.string().min(1),
  serviceType: z.string().min(1),
  subject: z.string().optional(),
  language: z.string().optional(),
  schoolId: z.string().optional(),
  schoolName: z.string().optional(),
});

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value || '2000';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function formatTimeHHMMInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // Example output: "09:00"
  return formatter.format(date);
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v || '').trim()).filter(Boolean);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
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

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      startTimeUTC: url.searchParams.get('startTimeUTC'),
      serviceType: url.searchParams.get('serviceType'),
      subject: url.searchParams.get('subject') || undefined,
      language: url.searchParams.get('language') || undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      schoolName: url.searchParams.get('schoolName') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues?.[0]?.message || 'Invalid query' }, { status: 400 });
    }

    const { startTimeUTC, serviceType, subject, language, schoolId, schoolName } = parsed.data;

    const startD = new Date(startTimeUTC);
    if (isNaN(startD.getTime())) {
      return NextResponse.json({ error: 'Invalid startTimeUTC (must be ISO timestamp)' }, { status: 400 });
    }

    const bookingTimeZone = 'America/New_York';
    const selectedDate = formatDateKeyInTimeZone(startD, bookingTimeZone);
    const selectedTime = formatTimeHHMMInTimeZone(startD, bookingTimeZone);

    const normalizedServiceType = normalizeServiceType(serviceType);
    // Booking rule: virtual tours reuse college counseling availability; test prep reuses tutoring.
    const inventoryServiceType =
      normalizedServiceType === 'virtual_tour'
        ? 'college_counseling'
        : normalizedServiceType === 'test_prep'
          ? 'tutoring'
          : normalizedServiceType;

    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep') && !String(subject || '').trim()) {
      return NextResponse.json({ error: 'subject is required for tutoring and test prep services' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const requestedSchoolId = String(schoolId || '').trim();
    const requestedSchoolName = String(schoolName || '').trim();
    const requestedSubjectRaw = String(subject || '').trim();
    const requestedLanguageRaw = String(language || '').trim();
    const requestedSubjectKey =
      normalizedServiceType === 'test_prep'
        ? 'test_prep'
        : requestedSubjectRaw
          ? normalizeSubjectId(requestedSubjectRaw)
          : null;

    // Subject is required for tutoring/test prep; if we cannot normalize it, treat as no match.
    if (normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep') {
      if (!requestedSubjectKey) {
        return NextResponse.json({ error: `Unrecognized subject: "${requestedSubjectRaw || subject || ''}"` }, { status: 400 });
      }
    }

    // FIX 2: Eligible providers must be computed ONLY from DB-backed `providers.subjects` (TEXT[] array).
    const { data: providerRowsAll, error: providerErr } = await supabase
      .from('providers')
      .select('id, data, subjects')
      .order('id', { ascending: true });
    if (providerErr) throw providerErr;

    const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');

    const providersAll = (providerRowsAll ?? [])
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

    const matchesServiceType = (p: (typeof providersAll)[number]) => {
      if (normalizedServiceType === 'virtual_tour') {
        return p.offersVirtualTours === true || p.services.includes('virtual_tour');
      }
      if (normalizedServiceType === 'college_counseling') {
        return p.services.includes('college_counseling') || p.services.includes('counseling') || p.offersVirtualTours === true;
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

    const matchesSubjectIfNeeded = (p: (typeof providersAll)[number]) => {
      // CRITICAL: If subjects is NULL or string -> exclude provider.
      if (!Array.isArray(p.subjects)) return false;
      if ((p.subjects as any[]).length === 0) return false;

      if (!(normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep')) {
        // For non-subject services, we still require a real subjects[] array (hard guard).
        return true;
      }
      if (!requestedSubjectKey) return false;
      if (!(p.subjects as any[]).includes(requestedSubjectKey)) return false;

      // Language tutoring: require a concrete language match (providers without languages are excluded).
      if (requestedSubjectKey === 'languages') {
        if (!requestedLanguageRaw) return false;
        if (!Array.isArray(p.languages) || p.languages.length === 0) return false;
        return p.languages.some((lang) => languageTutoringMatches(String(lang ?? ''), requestedLanguageRaw));
      }

      return true;
    };

    const matchesSchoolStrict = (p: (typeof providersAll)[number]) => {
      if (!requestedSchoolId && !requestedSchoolName) return true;
      if (requestedSchoolId) {
        return p.schoolIds.some((id) => String(id || '').trim() === requestedSchoolId);
      }
      const target = requestedSchoolName.toLowerCase();
      return p.schoolNames.some((n) => String(n || '').trim().toLowerCase() === target);
    };

    const baseCandidates = providersAll.filter(matchesServiceType).filter(matchesSubjectIfNeeded);

    let noSchoolMatch = false;
    let providerCandidates = baseCandidates;
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

    // Eligible providers computed STRICTLY from DB subjects[].
    const providerIds = uniqStrings(providerCandidates.map((p) => p.providerId));
    if (providerIds.length === 0) {
      return NextResponse.json({ providers: [], providerIds: [], noSchoolMatch }, { status: 200 });
    }

    // FIX 1: Fetch slots with strict provider filter at DB query level, then filter in backend for the selected time.
    const slotRows: Array<{ provider_id: string; start_time: string; end_time: string }> = [];
    for (const batch of chunkArray(providerIds, 200)) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('provider_id, start_time, end_time')
        .in('provider_id', batch)
        .eq('service_type', inventoryServiceType)
        .eq('is_booked', false)
        .order('provider_id', { ascending: true });
      if (error) throw error;
      for (const r of data ?? []) slotRows.push(r as any);
    }

    const startIsoTarget = startD.toISOString();
    const slotRowsAtTime = (slotRows ?? []).filter((r: any) => {
      try {
        return new Date(r?.start_time).toISOString() === startIsoTarget;
      } catch {
        return false;
      }
    });

    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .map((s) => ({
          providerId: String((s as any)?.providerId || '').trim(),
          start: typeof (s as any)?.startTime === 'string' ? new Date((s as any).startTime).toISOString() : '',
          end: typeof (s as any)?.endTime === 'string' ? new Date((s as any).endTime).toISOString() : '',
          status: String((s as any)?.status || 'available'),
        }))
        .filter((s) => s.providerId && s.start && s.end && s.status === 'reserved')
        .map((s) => `${s.providerId}|${s.start}|${s.end}`)
    );

    const candidateSlotRows = (slotRowsAtTime ?? [])
      .map((r: any) => {
        const providerId = String(r?.provider_id || '').trim();
        const startIso = new Date(r?.start_time).toISOString();
        const endIso = new Date(r?.end_time).toISOString();
        if (!providerId) return null;
        const key = `${providerId}|${startIso}|${endIso}`;
        if (reservedSet.has(key)) return null;
        return { providerId, startIso, endIso };
      })
      .filter(Boolean) as Array<{ providerId: string; startIso: string; endIso: string }>;

    const providerIdsFromSlots = Array.from(new Set(candidateSlotRows.map((r) => r.providerId)));
    if (providerIdsFromSlots.length === 0) {
      return NextResponse.json({ providers: [], providerIds: [], noSchoolMatch }, { status: 200 });
    }

    // Defensively exclude providers with overlapping booked sessions.
    const rangeStartISO = new Date(startD.getTime() - 60 * 60 * 1000).toISOString();
    const rangeEndISO = new Date(startD.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const bookedWindows = await getBookedSessionWindowsForProviders({
      providerIds: providerIdsFromSlots,
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

    const providerIdsStillFree = providerIdsFromSlots.filter((pid) => {
      const anyRow = candidateSlotRows.find((r) => r.providerId === pid);
      if (!anyRow) return false;
      const startMs = new Date(anyRow.startIso).getTime();
      const endMs = new Date(anyRow.endIso).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
      const windows = windowsByProvider.get(pid) || [];
      if (windows.length === 0) return true;
      return !overlapsAnyWindow(startMs, endMs, windows);
    });

    const shownProviderIds = providerCandidates
      .map((p) => p.providerId)
      .filter((pid) => providerIdsStillFree.includes(pid));

    console.log('[DATE_FILTER_DEBUG]', {
      selectedDate,
      selectedTime,
      matchingSlotCount: providerIdsStillFree.length,
      providerIds: shownProviderIds,
    });

    console.log('[BOOKING_FLOW]', {
      selectedService: normalizedServiceType,
      selectedTime: startD.toISOString(),
      providerIds: shownProviderIds,
      noSchoolMatch,
    });

    const shownProviders = providerCandidates.filter((p) => shownProviderIds.includes(p.providerId));

    return NextResponse.json(
      {
        providerIds: shownProviderIds,
        noSchoolMatch,
        providers: shownProviders.map((p) => ({
          providerId: p.providerId,
          name: p.providerName,
          school: p.providerSchoolName,
          profileImageUrl: p.profile_image_url || p.avatar,
          subjects: p.subjects,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/providers-at-time]' });
  }
}

