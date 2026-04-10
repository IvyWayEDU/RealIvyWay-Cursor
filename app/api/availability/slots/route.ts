import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { readReservedSlotsFile } from '@/lib/availability/store.server';
import { bindDateKeyAndMinutesToUtcDate, normalizeServiceType } from '@/lib/availability/engine';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { getBookedSessionWindowsForProviders } from '@/lib/sessions/bookedWindows.server';

type SlotOut = { start: string; end: string; providerId: string };

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
    // The booking UI selects dates/times in America/New_York, so interpret YYYY-MM-DD as a zoned day.
    const bookingTimeZone = 'America/New_York';
    const startOfDay = bindDateKeyAndMinutesToUtcDate(date, 0, bookingTimeZone);
    const endOfDay = new Date(bindDateKeyAndMinutesToUtcDate(date, 24 * 60, bookingTimeZone).getTime() - 1);

    console.log('[TIME_FILTER]', {
      dateKey: date,
      bookingTimeZone,
      startOfDayUTC: startOfDay.toISOString(),
      endOfDayUTC: endOfDay.toISOString(),
    });

    const queryStartISO = new Date(startOfDay.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const queryEndISO = new Date(endOfDay.getTime() + 6 * 60 * 60 * 1000).toISOString();

    const leadTimeHours = normalized === 'virtual_tour' ? 2 : 0;
    const minStartMs = Date.now() + leadTimeHours * 60 * 60 * 1000;

    const supabase = getSupabaseAdmin();
    console.log("[AVAILABILITY_FETCH]", { serviceType, providerId });

    let query = supabase
      .from('availability_slots')
      .select('provider_id, start_time, end_time')
      .eq('is_booked', false)
      .in('service_type', normalizedServiceTypes.length > 0 ? normalizedServiceTypes : [availabilityServiceType])
      .gte('start_time', queryStartISO)
      .lte('start_time', queryEndISO);

    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data: rows, error } = await query.order('start_time', { ascending: true });
    if (error) throw error;

    const reserved = await readReservedSlotsFile();
    const reservedSet = new Set(
      (reserved || [])
        .filter((s) => (s.status ?? 'available') === 'reserved')
        .map((s) => `${s.providerId}|${s.startTime}|${s.endTime}`)
    );

    const providerIds = Array.from(
      new Set((rows ?? []).map((r: any) => String(r?.provider_id || '').trim()).filter(Boolean))
    );
    const sessionQueryStartISO = new Date(startOfDay.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const sessionQueryEndISO = new Date(endOfDay.getTime() + 6 * 60 * 60 * 1000).toISOString();
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

    const slots: SlotOut[] = (rows ?? [])
      .map((r: any) => {
        const providerId = String(r?.provider_id || '').trim();
        const start = new Date(r?.start_time).toISOString();
        const end = new Date(r?.end_time).toISOString();
        if (!providerId) return null;
        const slotDateKey = formatDateKeyInTimeZone(new Date(start), bookingTimeZone);
        if (slotDateKey !== date) return null;
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
    console.log('[SLOT_RANGE_DEBUG]', {
      providerId: providerId || null,
      serviceType: normalizedServiceType,
      selectedDate: date,
      firstSlot: slotsSorted[0] || null,
      lastSlot: slotsSorted[slotsSorted.length - 1] || null,
      slotCount: slotsSorted.length,
    });
    
    return NextResponse.json({ slots });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability/slots]' });
  }
}
