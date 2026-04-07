'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export async function clearSessions() {
  if (process.env.NODE_ENV !== 'development') return;

  const supabase = getSupabaseAdmin();

  // Match-all filter that avoids invalid UUID casts.
  await supabase.from('sessions').delete().not('id', 'is', null);
  await supabase.from('bookings').delete().not('id', 'is', null);
  await supabase.from('reserved_slots').delete().not('id', 'is', null);
}

