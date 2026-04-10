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

const QuerySchema = z.object({
  startTimeUTC: z.string().min(1),
  serviceType: z.string().min(1),
  subject: z.string().optional(),
  language: z.string().optional(),
  schoolId: z.string().optional(),
  schoolName: z.string().optional(),
});

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v || '').trim()).filter(Boolean);
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
    const { data: rows, error } = await supabase
      .from('availability_slots')
      .select('provider_id, start_time, end_time')
      .eq('is_booked', false)
      .eq('service_type', inventoryServiceType)
      .eq('start_time', startD.toISOString())
      .order('provider_id', { ascending: true });
    if (error) throw error;

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

    const candidateSlotRows = (rows ?? [])
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
      console.log('[BOOKING_FLOW]', {
        selectedService: normalizedServiceType,
        selectedTime: startD.toISOString(),
        providerIds: [],
        noSchoolMatch: false,
      });
      return NextResponse.json({ providers: [], providerIds: [], noSchoolMatch: false }, { status: 200 });
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

    if (providerIdsStillFree.length === 0) {
      console.log('[BOOKING_FLOW]', {
        selectedService: normalizedServiceType,
        selectedTime: startD.toISOString(),
        providerIds: [],
        noSchoolMatch: false,
      });
      return NextResponse.json({ providers: [], providerIds: [], noSchoolMatch: false }, { status: 200 });
    }

    // Prefer `user_id` when available so we can also pull user-level subjects.
    let providerRows: any[] = [];
    {
      const attempt = await supabase
        .from('providers')
        .select('id, user_id, data')
        .in('id', providerIdsStillFree)
        .order('id', { ascending: true });
      if (!attempt.error) {
        providerRows = attempt.data ?? [];
      } else {
        const fallback = await supabase
          .from('providers')
          .select('id, data')
          .in('id', providerIdsStillFree)
          .order('id', { ascending: true });
        if (fallback.error) throw fallback.error;
        providerRows = fallback.data ?? [];
      }
    }

    const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');
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

    // Best-effort: load subjects from users.data.subjects when providers.data.subjects isn't populated.
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
      // ignore
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

        const subjects = Array.from(
          new Set(
            [
              ...(userId ? subjectsByUserId.get(userId) || [] : []),
              ...normalizeStringArray((data as any)?.subjects),
              ...normalizeStringArray((data as any)?.specialties),
            ]
              .map((s) => normalizeSubjectId(String(s ?? '').trim()))
              .filter((s): s is string => !!s)
          )
        );

        const providerLanguages = Array.from(
          new Set(
            [
              ...(userId ? languagesByUserId.get(userId) || [] : []),
              ...normalizeStringArray((data as any)?.languages),
            ]
              .map((s) => String(s ?? '').trim())
              .filter(Boolean)
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
          providerId: id,
          providerName,
          providerSchoolName,
          profile_image_url,
          avatar,
          schoolIds,
          schoolNames,
          services,
          offersVirtualTours,
          subjects: Array.isArray(subjects) ? subjects : [],
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
      if (!(normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep')) return true;
      if (!requestedSubjectKey) return false;
      if (!Array.isArray(p.subjects) || p.subjects.length === 0) return false;
      if (!p.subjects.some((ps) => subjectsMatch(ps, requestedSubjectKey))) return false;

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

    const providerIds = providerCandidates.map((p) => p.providerId);

    console.log('[BOOKING_FLOW]', {
      selectedService: normalizedServiceType,
      selectedTime: startD.toISOString(),
      providerIds,
      noSchoolMatch,
    });

    return NextResponse.json(
      {
        providerIds,
        noSchoolMatch,
        providers: providerCandidates.map((p) => ({
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

