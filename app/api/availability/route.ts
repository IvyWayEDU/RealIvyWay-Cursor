import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { DayAvailability } from '@/lib/availability/types';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { updateProviderAvailability } from '@/lib/providers/storage';

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

    return NextResponse.json(
      { availability: { providerId, serviceType, timezone, updatedAt, days, blocks } },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/availability] POST' });
  }
}
