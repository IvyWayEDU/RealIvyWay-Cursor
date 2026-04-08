import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export type ProviderEarningsBalance = {
  providerId: string;
  availableCents: number;
  pendingCents: number;
  withdrawnCents: number;
  createdAt: string;
  updatedAt: string;
};

type ProviderEarningsBalanceRow = {
  provider_id: string | null;
  available_cents: number | null;
  pending_cents: number | null;
  withdrawn_cents: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function toIntCents(v: unknown): number {
  const n = Math.floor(Number(v || 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function rowToBalance(row: ProviderEarningsBalanceRow, fallbackProviderId: string): ProviderEarningsBalance {
  const nowIso = new Date().toISOString();
  const providerId = String(row?.provider_id || fallbackProviderId || '').trim();
  return {
    providerId,
    availableCents: toIntCents(row?.available_cents),
    pendingCents: toIntCents(row?.pending_cents),
    withdrawnCents: toIntCents(row?.withdrawn_cents),
    createdAt: String(row?.created_at || nowIso),
    updatedAt: String(row?.updated_at || nowIso),
  };
}

async function ensureBalanceRow(providerId: string): Promise<ProviderEarningsBalance> {
  const pid = String(providerId || '').trim();
  if (!pid) throw new Error('[earnings.balances] providerId is required');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('provider_earnings_balances')
    .select('*')
    .eq('provider_id', pid)
    .maybeSingle();
  if (error) throw error;

  if (data) return rowToBalance(data as any, pid);

  const { data: inserted, error: insErr } = await supabase
    .from('provider_earnings_balances')
    .insert({ provider_id: pid, available_cents: 0, pending_cents: 0, withdrawn_cents: 0 } as any)
    .select('*')
    .single();
  if (insErr) throw insErr;

  return rowToBalance(inserted as any, pid);
}

export async function getProviderEarningsBalance(providerId: string): Promise<ProviderEarningsBalance> {
  return ensureBalanceRow(providerId);
}

export async function updateProviderEarningsBalance(args: {
  providerId: string;
  availableCents: number;
  pendingCents: number;
  withdrawnCents: number;
}): Promise<ProviderEarningsBalance> {
  const pid = String(args.providerId || '').trim();
  if (!pid) throw new Error('[earnings.balances] providerId is required');

  // Ensure row exists so update always matches something.
  await ensureBalanceRow(pid);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('provider_earnings_balances')
    .update({
      available_cents: toIntCents(args.availableCents),
      pending_cents: toIntCents(args.pendingCents),
      withdrawn_cents: toIntCents(args.withdrawnCents),
    } as any)
    .eq('provider_id', pid)
    .select('*')
    .single();
  if (error) throw error;
  return rowToBalance(data as any, pid);
}

/**
 * Backward-compatible helper (legacy call sites).
 * Treats "balance" as the withdrawable amount.
 */
export async function getProviderEarningsBalanceCents(providerId: string): Promise<number> {
  const b = await getProviderEarningsBalance(providerId);
  return b.availableCents;
}

/**
 * Backward-compatible helper (legacy call sites).
 * Debits withdrawable balance (available_cents).
 */
export async function debitProviderEarningsBalanceCents(providerId: string, amountCents: number): Promise<number> {
  const b = await getProviderEarningsBalance(providerId);
  const amt = toIntCents(amountCents);
  const next = await updateProviderEarningsBalance({
    providerId,
    availableCents: Math.max(0, b.availableCents - amt),
    pendingCents: b.pendingCents,
    withdrawnCents: b.withdrawnCents,
  });
  return next.availableCents;
}


