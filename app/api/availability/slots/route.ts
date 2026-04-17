import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { readReservedSlotsFile } from '@/lib/availability/store.server';
import { normalizeServiceType } from '@/lib/availability/engine';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';
import { normalizeSubjectId } from '@/lib/models/subjects';

type SlotOut = { start: string; end: string; providerId: string };

function normalizeSubject(s: unknown): string | null {
  if (!s) return null;
  const val = String(s).toLowerCase().trim();

  if (val === 'math' || val === 'mathematics') return 'math';
  if (val === 'english') return 'english';
  if (val === 'computer science') return 'computer_science';
  if (val === 'test prep') return 'test_prep';
  if (val === 'languages') return 'languages';

  return null;
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

function parseIsoDateYYYYMMDDToUtcDate(dateKey: string): Date {
  const [yRaw, mRaw, dRaw] = String(dateKey || '').trim().split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date('invalid');
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const serviceTypeAll = searchParams
      .getAll('serviceType')
      .map((s) => String(s || '').trim())
      .filter(Boolean);
    const serviceType: string | string[] | undefined =
      serviceTypeAll.length > 1 ? serviceTypeAll : serviceTypeAll[0] || undefined;
    const subject = searchParams.get('subject') || undefined;
    const providerId = searchParams.get('providerId') || undefined;
    
    // Validate input
    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    // Validate serviceType is provided
    if (!serviceType) {
      return NextResponse.json(
        { error: 'serviceType parameter is required' },
        { status: 400 }
      );
    }

    const serviceTypePrimary = Array.isArray(serviceType) ? serviceType[0] : serviceType;
    if (!serviceTypePrimary) {
      return NextResponse.json({ error: 'serviceType parameter is required' }, { status: 400 });
    }

    // Validate/normalize serviceType early to return 400 on bad inputs (not 500)
    try {
      normalizeServiceType(serviceTypePrimary);
      if (Array.isArray(serviceType)) {
        for (const st of serviceType) normalizeServiceType(st);
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid serviceType parameter' },
        { status: 400 }
      );
    }
    
    // Validate subject is required for tutoring and test_prep
    const normalizedServiceType = serviceTypePrimary.toLowerCase().replace(/-/g, '_');
    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep' || normalizedServiceType === 'testprep') && !subject) {
      return NextResponse.json(
        { error: 'subject parameter is required for tutoring and test prep services' },
        { status: 400 }
      );
    }
    
    // Fetch concrete slots from Supabase (excludes reserved slots + booked sessions defensively)
    const normalized = normalizeServiceType(serviceTypePrimary);
    const availabilityServiceType =
      normalized === 'virtual_tour'
        ? 'college_counseling'
        : normalized === 'test_prep'
          ? 'tutoring'
          : normalized;

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

    // Strict date filtering:
    // Interpret the selected YYYY-MM-DD as a UTC day and query ONLY by UTC bounds.
    // Do not use local time comparisons or timezone-based re-filtering.
    const selectedDate = date;
    const startOfDay = parseIsoDateYYYYMMDDToUtcDate(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = parseIsoDateYYYYMMDDToUtcDate(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const queryStartISO = startOfDay.toISOString();
    const queryEndISO = endOfDay.toISOString();

    const leadTimeHours = normalized === 'virtual_tour' ? 2 : 0;
    const minStartMs = Date.now() + leadTimeHours * 60 * 60 * 1000;

    const supabase = getSupabaseAdmin();
    console.log("[AVAILABILITY_FETCH]", { serviceType, providerId });

    // Build eligibleProviderIds STRICTLY from raw subjects/specialties (provider + user profile JSON).
    const { data: providerRows, error: provErr } = await supabase
      .from('providers')
      .select('id, data')
      .order('id', { ascending: true });
    if (provErr) throw provErr;

    const subjectKeyRaw = String(subject || '').trim();
    const selectedSubject =
      normalizedServiceType === 'test_prep' ? 'test_prep' : normalizeSubject(subjectKeyRaw);

    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep') && !selectedSubject) {
      return NextResponse.json({ error: `Unrecognized subject: "${subjectKeyRaw || subject || ''}"` }, { status: 400 });
    }

    const providers = (providerRows ?? [])
      .map((r: any) => ({
        id: typeof r?.id === 'string' ? String(r.id).trim() : '',
        data: r?.data && typeof r.data === 'object' ? r.data : {},
      }))
      .filter((p: any) => !!p.id);

    const providerIds = providers.map((p: any) => p.id).filter(Boolean) as string[];
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

    const normalizedSubjectsMap: Record<string, string[]> = {};
    for (const p of providers) {
      const userData = userDataById.get(p.id) && typeof userDataById.get(p.id) === 'object' ? userDataById.get(p.id) : {};
      const rawSubjects = [
        ...(((p as any).data?.subjects as any[]) || []),
        ...(((p as any).data?.specialties as any[]) || []),
        ...(((userData as any)?.subjects as any[]) || []),
        ...(((userData as any)?.specialties as any[]) || []),
      ];

      if (rawSubjects.length === 0) {
        normalizedSubjectsMap[p.id] = [];
        continue;
      }

      normalizedSubjectsMap[p.id] = rawSubjects.map(normalizeSubject).filter(Boolean) as string[];
    }

    const eligibleProviderIds = providers
      .filter((p: any) => {
        const rawSubjects = [
          ...(((p as any).data?.subjects as any[]) || []),
          ...(((p as any).data?.specialties as any[]) || []),
          ...(((userDataById.get(p.id) as any)?.subjects as any[]) || []),
          ...(((userDataById.get(p.id) as any)?.specialties as any[]) || []),
        ];
        if (rawSubjects.length === 0) return false;
        const subjects = normalizedSubjectsMap[p.id] || [];
        return !!selectedSubject && subjects.includes(selectedSubject);
      })
      .map((p: any) => p.id);

    console.log('[SUBJECT_FILTER_DEBUG]', {
      selectedSubject,
      providers: providers.map((p: any) => ({
        id: p.id,
        rawSubjects: [
          ...(((p as any).data?.subjects as any[]) || []),
          ...(((p as any).data?.specialties as any[]) || []),
        ],
        normalized: normalizedSubjectsMap[p.id],
      })),
      eligibleProviderIds,
    });

    const idsToQueryRaw = providerId ? [String(providerId).trim()] : eligibleProviderIds;
    const eligibleProviderIdSet = new Set(eligibleProviderIds);
    const idsToQuery = idsToQueryRaw.filter((id) => eligibleProviderIdSet.has(id));

    if (idsToQuery.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    // FIX 1: Fetch slots with strict provider filter at DB query level.
    const rows: any[] = [];
    for (const batch of chunkArray(idsToQuery, 200)) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('provider_id, start_time, end_time, service_type, is_booked')
        .in('provider_id', batch)
        .eq('service_type', availabilityServiceType)
        .eq('is_booked', false)
        .order('start_time', { ascending: true });
      if (error) throw error;
      for (const r of data ?? []) rows.push(r as any);
    }

    // Filter by date in backend (NOT frontend)
    const selected = new Date(String(selectedDate || '').trim());
    const rowsForDate = (rows ?? []).filter((r: any) => {
      try {
        const slotDate = new Date(r?.start_time);
        return slotDate.toDateString() === selected.toDateString();
      } catch {
        return false;
      }
    });

    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .filter((s) => (s.status ?? 'available') === 'reserved')
        .map((s) => `${s.providerId}|${s.startTime}|${s.endTime}`)
    );

    const providerIds = Array.from(
      new Set((rowsForDate ?? []).map((r: any) => String(r?.provider_id || '').trim()).filter(Boolean))
    );
    const sessionQueryStartISO = queryStartISO;
    const sessionQueryEndISO = queryEndISO;
    const bookedWindows = await getBookedSessionWindowsForProviders({
      providerIds,
      rangeStartISO: sessionQueryStartISO,
      rangeEndISO: sessionQueryEndISO,
      defaultDurationMinutesWhenMissingEnd: 60,
    });
    const windowsByProvider = new Map<string, Array<{ sessionStartMs: number; sessionEndMs: number }>>();
    for (const w of bookedWindows || []) {
      const arr = windowsByProvider.get(w.providerId) || [];
      arr.push({ sessionStartMs: w.sessionStartMs, sessionEndMs: w.sessionEndMs });
      windowsByProvider.set(w.providerId, arr);
    }

    const slots: SlotOut[] = (rowsForDate ?? [])
      .map((r: any) => {
        const providerId = String(r?.provider_id || '').trim();
        const start = new Date(r?.start_time).toISOString();
        const end = new Date(r?.end_time).toISOString();
        if (!providerId) return null;
        const startMs = new Date(start).getTime();
        const endMs = new Date(end).getTime();
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
        if (startMs < minStartMs) return null;

        const reservationKey = `${providerId}|${start}|${end}`;
        if (reservedSet.has(reservationKey)) return null;

        const windows = windowsByProvider.get(providerId) || [];
        if (windows.length > 0) {
          for (const w of windows) {
            if (startMs < w.sessionEndMs && endMs > w.sessionStartMs) return null;
          }
        }

        return { providerId, start, end } satisfies SlotOut;
      })
      .filter(Boolean) as SlotOut[];

    const slotsSorted = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const shownProviders = Array.from(new Set(slotsSorted.map((s) => s.providerId))).filter(Boolean);
    
    return NextResponse.json({ slots });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/slots]' });
  }
}
