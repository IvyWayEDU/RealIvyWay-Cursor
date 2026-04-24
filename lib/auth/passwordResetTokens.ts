import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

const TABLE = 'password_reset_tokens';

export async function createPasswordResetTokenRow(args: {
  userId: string;
  tokenHash: string;
  expiresAtIso: string;
  requestIp?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const userId = String(args.userId || '').trim();
  const tokenHash = String(args.tokenHash || '').trim().toLowerCase();
  const expiresAt = String(args.expiresAtIso || '').trim();
  if (!userId || !tokenHash || !expiresAt) return;

  // Keep only one active token per user (best-effort).
  await supabase.from(TABLE).delete().eq('user_id', userId).is('used_at', null);

  const { error } = await supabase.from(TABLE).insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    request_ip: args.requestIp ? String(args.requestIp).trim() : null,
  });
  if (error) throw error;
}

export async function consumePasswordResetToken(args: {
  userId: string;
  tokenHash: string;
  nowIso: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const userId = String(args.userId || '').trim();
  const tokenHash = String(args.tokenHash || '').trim().toLowerCase();
  const nowIso = String(args.nowIso || '').trim();
  if (!userId || !tokenHash || !nowIso) return false;

  const { data, error } = await supabase
    .from(TABLE)
    .update({ used_at: nowIso })
    .eq('user_id', userId)
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('id')
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

