import type { DayAvailability, ProviderAvailability } from '@/lib/availability/types';
import type { AvailabilityBlock, AvailabilityEntry } from '@/lib/availability/store.server';

export function normalizeDays(days: DayAvailability[] | undefined | null): DayAvailability[] {
  const safe = Array.isArray(days) ? days : [];
  const byDow = new Map<number, DayAvailability>();
  for (const d of safe) {
    const dayOfWeek = Number(d?.dayOfWeek);
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
    const enabled = Boolean(d?.enabled);
    const timeRanges = Array.isArray(d?.timeRanges)
      ? d.timeRanges
          .map((r) => ({
            startMinutes: Number((r as any)?.startMinutes),
            endMinutes: Number((r as any)?.endMinutes),
          }))
          .filter(
            (r) =>
              Number.isFinite(r.startMinutes) &&
              Number.isFinite(r.endMinutes) &&
              r.startMinutes >= 0 &&
              r.endMinutes <= 1440 &&
              r.endMinutes > r.startMinutes
          )
      : [];

    byDow.set(dayOfWeek, { dayOfWeek, enabled, timeRanges });
  }

  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const existing = byDow.get(dayOfWeek);
    return (
      existing ?? {
        dayOfWeek,
        enabled: false,
        timeRanges: [],
      }
    );
  });
}

export function daysToBlocks(days: DayAvailability[]): AvailabilityBlock[] {
  const normalized = normalizeDays(days);
  const blocks: AvailabilityBlock[] = [];
  for (const day of normalized) {
    if (!day.enabled) continue;
    for (const r of day.timeRanges || []) {
      blocks.push({
        dayOfWeek: day.dayOfWeek,
        startMinutes: r.startMinutes,
        endMinutes: r.endMinutes,
      });
    }
  }
  return blocks;
}

export function entryToProviderAvailability(entry: AvailabilityEntry): ProviderAvailability {
  const days: DayAvailability[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: false,
    timeRanges: [],
  }));

  for (const b of entry.blocks || []) {
    if (!b) continue;
    const dow = Number((b as any).dayOfWeek);
    const startMinutes = Number((b as any).startMinutes);
    const endMinutes = Number((b as any).endMinutes);
    if (!Number.isFinite(dow) || dow < 0 || dow > 6) continue;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) continue;
    if (!days[dow]) continue;
    days[dow].enabled = true;
    days[dow].timeRanges.push({ startMinutes, endMinutes });
  }

  // Sort for stable UI display
  for (const d of days) {
    d.timeRanges.sort((a, b) => a.startMinutes - b.startMinutes);
  }

  return {
    providerId: entry.providerId,
    timezone: entry.timezone,
    days,
    updatedAt: entry.updatedAt,
  };
}


