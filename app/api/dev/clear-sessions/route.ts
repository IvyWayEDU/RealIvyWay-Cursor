import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errorHandler';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

/**
 * DEV-ONLY: Clear all session-related data for fast iteration.
 *
 * Deletes all rows from:
 * - sessions
 * - bookings
 * - reserved_slots
 *
 * Does NOT touch users.
 */
export async function POST() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Use a "match all rows" filter that is guaranteed true for these tables
    // (primary key `id` is NOT NULL).
    const deleteAll = async (table: 'reserved_slots' | 'bookings' | 'sessions') => {
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error) throw error;
    };

    // FK-safety: clear reserved slots first, then checkout bookings, then sessions.
    await deleteAll('reserved_slots');
    await deleteAll('bookings');
    await deleteAll('sessions');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/dev/clear-sessions]' });
  }
}

