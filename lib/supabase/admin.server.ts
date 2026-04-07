import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMainSupabaseEnv } from '@/lib/supabase/config.server';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const { url, serviceRoleKey } = getMainSupabaseEnv();

  _admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return _admin;
}

