import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export const DOUBLE_BOOKING_MESSAGE =
  'You already have a session scheduled at this time. Please choose a different time.';

export class DoubleBookingError extends Error {
  readonly statusCode = 400;
  constructor(message: string = DOUBLE_BOOKING_MESSAGE) {
    super(message);
    this.name = 'DoubleBookingError';
  }
}

function toIsoOrThrow(v: unknown, label: string): string {
  const d = v instanceof Date ? v : new Date(v as any);
  const t = d.getTime();
  if (!Number.isFinite(t)) throw new Error(`Invalid ${label}`);
  return d.toISOString();
}

type Conflict = {
  id: string;
  start: string;
  end: string;
  status: string | null;
  serviceType: string | null;
};

export async function findStudentOverlappingSessions(params: {
  studentId: string;
  newStart: string;
  newEnd: string;
  excludeSessionId?: string;
}): Promise<Conflict[]> {
  const studentId = String(params.studentId || '').trim();
  if (!studentId) throw new Error('Missing studentId');

  const newStartIso = toIsoOrThrow(params.newStart, 'newStart');
  const newEndIso = toIsoOrThrow(params.newEnd, 'newEnd');
  if (new Date(newEndIso).getTime() <= new Date(newStartIso).getTime()) {
    throw new Error('Invalid new time range');
  }

  const excludeId = String(params.excludeSessionId || '').trim() || null;

  // Fetch a small candidate set (student sessions are typically small).
  // We still apply a coarse filter in SQL: existingStart < newEnd AND status != cancelled.
  const supabase = getSupabaseAdmin();
  const query = supabase
    .from('sessions')
    .select('id, datetime, end_datetime, status, data')
    .eq('student_id', studentId)
    .neq('status', 'cancelled')
    .lt('datetime', newEndIso)
    .order('datetime', { ascending: true })
    .limit(50);

  const { data, error } = await (excludeId ? query.neq('id', excludeId) : query);
  if (error) throw error;

  const conflicts: Conflict[] = [];
  for (const row of (data ?? []) as any[]) {
    const id = typeof row?.id === 'string' ? row.id : String(row?.id || '');
    if (!id) continue;

    const startIso = toIsoOrThrow(row?.datetime, 'session datetime');
    const endIso =
      row?.end_datetime != null
        ? toIsoOrThrow(row.end_datetime, 'session end_datetime')
        : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();

    // Overlap: (start < newEnd) AND (end > newStart)
    if (new Date(startIso).getTime() < new Date(newEndIso).getTime() && new Date(endIso).getTime() > new Date(newStartIso).getTime()) {
      const serviceTypeRaw =
        typeof row?.data?.serviceType === 'string'
          ? row.data.serviceType
          : typeof row?.data?.service_type === 'string'
            ? row.data.service_type
            : null;
      conflicts.push({
        id,
        start: startIso,
        end: endIso,
        status: typeof row?.status === 'string' ? row.status : null,
        serviceType: typeof serviceTypeRaw === 'string' ? serviceTypeRaw : null,
      });
    }
  }

  console.log('[DOUBLE_BOOKING_CHECK]', {
    studentId,
    newStart: newStartIso,
    newEnd: newEndIso,
    conflictsFound: conflicts.length,
  });

  return conflicts;
}

export async function assertNoStudentDoubleBooking(params: {
  studentId: string;
  newStart: string;
  newEnd: string;
  excludeSessionId?: string;
}): Promise<void> {
  const conflicts = await findStudentOverlappingSessions(params);
  if (conflicts.length > 0) {
    throw new DoubleBookingError(DOUBLE_BOOKING_MESSAGE);
  }
}

