import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export type BookedSessionWindow = {
  providerId: string;
  sessionStartMs: number;
  sessionEndMs: number;
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toMs(value: unknown): number {
  const d = value instanceof Date ? value : new Date(value as any);
  const t = d.getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Fetch booked session windows from Supabase `sessions` table for a set of providers.
 *
 * IMPORTANT:
 * - Uses canonical DB columns: provider_id, datetime, end_datetime, status
 * - Treats end_datetime=null as start+defaultDurationMinutes (per requirements)
 * - Excludes cancelled sessions at query-time (matches booking integrity rules)
 */
export async function getBookedSessionWindowsForProviders(params: {
  providerIds: string[];
  rangeStartISO?: string;
  rangeEndISO?: string;
  defaultDurationMinutesWhenMissingEnd?: number;
}): Promise<BookedSessionWindow[]> {
  const providerIds = (params.providerIds || []).map((p) => String(p || '').trim()).filter(Boolean);
  if (providerIds.length === 0) return [];

  const rangeStartISO = params.rangeStartISO ? String(params.rangeStartISO) : null;
  const rangeEndISO = params.rangeEndISO ? String(params.rangeEndISO) : null;
  const defaultDurationMinutesWhenMissingEnd = Number.isFinite(params.defaultDurationMinutesWhenMissingEnd)
    ? Math.max(1, Number(params.defaultDurationMinutesWhenMissingEnd))
    : 60;
  const defaultDurationMs = defaultDurationMinutesWhenMissingEnd * 60 * 1000;

  const supabase = getSupabaseAdmin();
  const out: BookedSessionWindow[] = [];

  // Keep queries reasonably sized to avoid large `in(...)` payloads.
  for (const batch of chunkArray(providerIds, 200)) {
    let q = supabase
      .from('sessions')
      .select('provider_id, datetime, end_datetime, status')
      .in('provider_id', batch)
      .neq('status', 'cancelled')
      .order('datetime', { ascending: true });

    if (rangeStartISO) q = q.gte('datetime', rangeStartISO);
    if (rangeEndISO) q = q.lt('datetime', rangeEndISO);

    const { data, error } = await q;
    if (error) {
      console.error('[sessions/bookedWindows] Error reading sessions from Supabase:', error);
      continue;
    }

    for (const row of data ?? []) {
      const providerId = typeof (row as any)?.provider_id === 'string' ? String((row as any).provider_id).trim() : '';
      if (!providerId) continue;

      const startMs = toMs((row as any)?.datetime);
      if (!Number.isFinite(startMs)) continue;

      const endMsRaw = toMs((row as any)?.end_datetime);
      const endMs = Number.isFinite(endMsRaw) && endMsRaw > startMs ? endMsRaw : startMs + defaultDurationMs;

      out.push({ providerId, sessionStartMs: startMs, sessionEndMs: endMs });
    }
  }

  return out;
}

