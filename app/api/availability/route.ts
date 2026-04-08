import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { DayAvailability } from '@/lib/availability/types';
import { bindDateKeyAndMinutesToUtcDate, generateSlotsForBlocks, normalizeServiceType } from '@/lib/availability/engine';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { updateProviderAvailability } from '@/lib/providers/storage';

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

function getZonedDayOfWeek(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date(date).getUTCDay();
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).getUTCDay();
}

async function regenerateAvailabilitySlots(params: {
  providerId: string;
  serviceType: string;
  timezone: string;
  blocks: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }>;
}): Promise<void> {
  const providerId = String(params.providerId || '').trim();
  const timezone = String(params.timezone || '').trim() || 'America/New_York';
  const canonicalServiceType = normalizeServiceType(String(params.serviceType || '').trim());
  // Booking rule: virtual tours reuse college counseling availability; test prep reuses tutoring.
  const slotServiceType =
    canonicalServiceType === 'virtual_tour'
      ? 'college_counseling'
      : canonicalServiceType === 'test_prep'
        ? 'tutoring'
        : canonicalServiceType;

  if (!providerId) throw new Error('providerId is required to regenerate slots');

  const blocks = Array.isArray(params.blocks) ? params.blocks : [];
  const normalizedBlocks = blocks
    .map((b: any) => ({
      dayOfWeek: Number(b?.dayOfWeek),
      startMinutes: Number(b?.startMinutes),
      endMinutes: Number(b?.endMinutes),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.dayOfWeek) &&
        b.dayOfWeek >= 0 &&
        b.dayOfWeek <= 6 &&
        Number.isFinite(b.startMinutes) &&
        Number.isFinite(b.endMinutes) &&
        b.endMinutes > b.startMinutes &&
        b.startMinutes >= 0 &&
        b.endMinutes <= 1440
    );

  const supabase = getSupabaseAdmin();
  const now = new Date();

  // Remove FUTURE, UNBOOKED slots so we can replace inventory.
  // Keep booked rows for history; keep past rows untouched.
  const { error: delErr } = await supabase
    .from('availability_slots')
    .delete()
    .eq('provider_id', providerId)
    .eq('service_type', slotServiceType)
    .eq('is_booked', false)
    .gt('start_time', now.toISOString());
  if (delErr) throw delErr;

  if (normalizedBlocks.length === 0) return;

  // Next 4 weeks (28 days), computed in provider timezone with a midday anchor to avoid DST edge cases.
  const todayKey = formatDateKeyInTimeZone(now, timezone);
  const anchorMiddayUtc = bindDateKeyAndMinutesToUtcDate(todayKey, 12 * 60, timezone);

  const durationMinutes = 60; // IvyWay invariant for all services today
  const slotsToInsert: Array<{
    provider_id: string;
    service_type: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
  }> = [];

  for (let i = 0; i < 28; i++) {
    const day = new Date(anchorMiddayUtc.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = formatDateKeyInTimeZone(day, timezone);
    const dow = getZonedDayOfWeek(day, timezone);

    const blocksForDay = normalizedBlocks
      .filter((b) => b.dayOfWeek === dow)
      .map((b) => ({ startMinutes: b.startMinutes, endMinutes: b.endMinutes }));
    if (blocksForDay.length === 0) continue;

    const startISOs = generateSlotsForBlocks(blocksForDay, dateKey, {
      slotIntervalMinutes: durationMinutes,
      sessionDurationMinutes: durationMinutes,
      roundToInterval: true,
      timeZone: timezone,
    });

    for (const startIso of startISOs) {
      const startMs = new Date(startIso).getTime();
      if (!Number.isFinite(startMs)) continue;
      const endIso = new Date(startMs + durationMinutes * 60 * 1000).toISOString();
      slotsToInsert.push({
        provider_id: providerId,
        service_type: slotServiceType,
        start_time: startIso,
        end_time: endIso,
        is_booked: false,
      });
    }
  }

  if (slotsToInsert.length === 0) return;

  for (const slot of slotsToInsert) {
    console.log("Inserting availability slot:", slot);
  }

  // Insert concrete inventory (no ON CONFLICT clause).
  const { error: insErr } = await supabase.from('availability_slots').insert(slotsToInsert as any);
  if (insErr) throw insErr;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    const { searchParams } = new URL(request.url);
    const providerIdParam = searchParams.get('providerId');
    const serviceTypeParam = searchParams.get('serviceType');

    const providerId = providerIdParam ? String(providerIdParam) : session.userId;
    const serviceType = serviceTypeParam ? String(serviceTypeParam) : null;
    
    // Access control: non-admin can only access their own.
    if (!session.roles.includes('admin') && providerId !== session.userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only access your own availability' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase.from('providers').select('id, data').eq('id', providerId).maybeSingle();
    if (error) throw error;
    const data = row?.data && typeof row.data === 'object' ? row.data : {};
    const availabilityRaw = (data as any)?.availability;
    const availabilityArray: any[] = Array.isArray(availabilityRaw)
      ? availabilityRaw
      : availabilityRaw && typeof availabilityRaw === 'object'
        ? Object.entries(availabilityRaw as Record<string, any>).map(([serviceType, payload]) => ({
            serviceType,
            ...(payload && typeof payload === 'object' ? payload : {}),
          }))
        : [];

    if (serviceType) {
      const entry = availabilityArray.find((a: any) => String(a?.serviceType || '').trim() === serviceType) || null;
      return NextResponse.json({ availability: entry });
    }

    // No serviceType: return provider's entire availability array (admin may request other providerId via query param).
    return NextResponse.json({ availability: availabilityArray });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability] GET' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // Only providers can set availability
    if (!session.roles.includes('provider') && !session.roles.includes('admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Provider role required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const requestedProviderId = typeof body?.providerId === 'string' ? body.providerId : null;
    const providerId = session.roles.includes('admin') && requestedProviderId ? requestedProviderId : session.userId;
    const timezone = typeof body?.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'America/New_York';
    const serviceType = typeof body?.serviceType === 'string' ? body.serviceType.trim() : '';
    const intent = typeof body?.intent === 'string' ? body.intent.trim() : 'save';
    const days = body?.days as DayAvailability[] | undefined;
    
    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    if (!serviceType) {
      return NextResponse.json(
        { error: 'serviceType is required' },
        { status: 400 }
      );
    }
    
    // Check access: provider can only set their own, admin can set any
    if (!session.roles.includes('admin') && providerId !== session.userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only set your own availability' },
        { status: 403 }
      );
    }

    // Clear flow (explicit action)
    if (intent === 'clear') {
      const updatedAt = new Date().toISOString();
      await updateProviderAvailability(providerId, { serviceType, timezone, updatedAt, days: [], blocks: [] });
      // Replace slot inventory: remove future unbooked slots for this provider/serviceType.
      try {
        const supabase = getSupabaseAdmin();
        const canonical = normalizeServiceType(serviceType);
        const slotServiceType = canonical === 'virtual_tour' ? 'college_counseling' : canonical === 'test_prep' ? 'tutoring' : canonical;
        const { error: delErr } = await supabase
          .from('availability_slots')
          .delete()
          .eq('provider_id', providerId)
          .eq('service_type', slotServiceType)
          .eq('is_booked', false)
          .gt('start_time', new Date().toISOString());
        if (delErr) throw delErr;
      } catch (e) {
        console.error('[AVAILABILITY_SLOTS_CLEAR_FAILED]', {
          providerId,
          serviceType,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
      console.log('[AVAILABILITY_WRITE]', { providerId, serviceType, daysCount: 0 });
      return NextResponse.json({ availability: { providerId, serviceType, timezone, updatedAt, days: [], blocks: [] } }, { status: 200 });
    }
    
    // Validate input (save)
    if (!days || !Array.isArray(days)) {
      return NextResponse.json(
        { error: 'days is required' },
        { status: 400 }
      );
    }

    // Validate days structure (must support ALL 7 days: 0..6 exactly once; no silent normalization)
    const dayOfWeekSeen = new Set<number>();
    for (let i = 0; i < 7; i++) {
      const day = days[i] as any;
      const dayOfWeek = Number(day?.dayOfWeek);
      if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json(
          { error: `Invalid dayOfWeek for day index ${i} (must be 0..6)` },
          { status: 400 }
        );
      }
      if (dayOfWeekSeen.has(dayOfWeek)) {
        return NextResponse.json(
          { error: `Duplicate dayOfWeek ${dayOfWeek} in availability payload` },
          { status: 400 }
        );
      }
      dayOfWeekSeen.add(dayOfWeek);

      if (typeof day?.enabled !== 'boolean' || !Array.isArray(day?.timeRanges)) {
        return NextResponse.json(
          { error: `Invalid day structure for day ${i}` },
          { status: 400 }
        );
      }
      
      if (day.enabled && day.timeRanges.length > 0) {
        for (const range of day.timeRanges) {
          const startMinutes = (range as any).startMinutes;
          const endMinutes = (range as any).endMinutes;
          if (typeof startMinutes !== 'number' || typeof endMinutes !== 'number') {
            return NextResponse.json(
              { error: `Invalid time range for day ${i}` },
              { status: 400 }
            );
          }
          if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes < 0 || endMinutes > 1440 || endMinutes <= startMinutes) {
            return NextResponse.json(
              { error: `Invalid time range minutes for day ${i}` },
              { status: 400 }
            );
          }
        }
      }
    }

    if (dayOfWeekSeen.size !== 7) {
      return NextResponse.json(
        { error: 'Availability payload must include exactly 7 unique days (0..6)' },
        { status: 400 }
      );
    }
    
    // Convert days -> blocks for booking runtime (read-only downstream).
    // NOTE: We do NOT sort or normalize; we store exactly what was saved.
    const blocks = days
      .flatMap((d) => {
        const dow = Number((d as any).dayOfWeek);
        if (!(d as any).enabled) return [];
        const trs = Array.isArray((d as any).timeRanges) ? (d as any).timeRanges : [];
        return trs.map((r: any) => ({
          dayOfWeek: dow,
          startMinutes: Number(r.startMinutes),
          endMinutes: Number(r.endMinutes),
        }));
      });

    const updatedAt = new Date().toISOString();
    await updateProviderAvailability(providerId, { serviceType, timezone, updatedAt, days, blocks });
    console.log('[AVAILABILITY_WRITE]', { providerId, serviceType, daysCount: days.length });

    // Concrete slot inventory (next 4 weeks) is stored in Supabase `availability_slots`.
    await regenerateAvailabilitySlots({ providerId, serviceType, timezone, blocks });

    return NextResponse.json(
      { availability: { providerId, serviceType, timezone, updatedAt, days, blocks } },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability] POST' });
  }
}
