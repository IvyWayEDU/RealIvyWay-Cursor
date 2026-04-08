'use server';

import 'server-only';

import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

/**
 * Bank account metadata for a provider
 */
export interface BankAccount {
  providerId: string;
  bankName: string;
  last4: string; // Last 4 digits of account number only
  accountType: 'checking' | 'savings';
  connectedAt: string; // ISO timestamp when account was connected
  status: 'active' | 'disconnected'; // Account status
}

type BankAccountDbRow = {
  id: string;
  provider_id: string;
  account_name: string;
  account_number: string;
  routing_number: string;
  bank_name: string;
  account_type: 'checking' | 'savings' | null;
  status: 'active' | 'disconnected' | null;
  created_at: string;
  updated_at: string;
};

const BANK_ACCOUNTS_TABLE = 'bank_accounts';

function toLast4(accountNumber: unknown): string {
  if (typeof accountNumber !== 'string') return '****';
  const v = accountNumber.trim();
  if (v.length >= 4) return v.slice(-4);
  return '****';
}

function normalizeDbRowToPublic(row: BankAccountDbRow): BankAccount {
  const connectedAt = row?.created_at || new Date().toISOString();
  const accountType = row?.account_type === 'savings' ? 'savings' : 'checking';
  const status = row?.status === 'disconnected' ? 'disconnected' : 'active';
  return {
    providerId: row.provider_id,
    bankName: row.bank_name,
    last4: toLast4(row.account_number),
    accountType,
    connectedAt,
    status,
  };
}

/**
 * Set bank account for a provider
 *
 * @param providerId - The provider ID
 * @param accountData - Bank account data (stored in Supabase)
 * @returns Bank account metadata (masked)
 */
export async function setBankAccount(
  providerId: string,
  accountData: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    accountType?: 'checking' | 'savings';
  }
): Promise<BankAccount> {
  const pid = String(providerId || '').trim();
  if (!pid) throw new Error('providerId is required');

  const bank_name = String(accountData.bankName || '').trim();
  const account_name = String(accountData.accountName || '').trim();
  const account_number = String(accountData.accountNumber || '').trim();
  const routing_number = String(accountData.routingNumber || '').trim();
  const account_type = accountData.accountType === 'savings' ? 'savings' : 'checking';

  // Required debug log (requested)
  console.log('Saving bank account:', pid);

  const supabase = getSupabaseAdmin();

  // Enforce "only one bank account per provider" by treating provider_id as a unique key.
  const { data: existing, error: existingErr } = await supabase
    .from(BANK_ACCOUNTS_TABLE)
    .select('*')
    .eq('provider_id', pid)
    .limit(1)
    .maybeSingle();
  if (existingErr) throw existingErr;

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from(BANK_ACCOUNTS_TABLE)
      .update({
        account_name,
        account_number,
        routing_number,
        bank_name,
        account_type,
        status: 'active',
      } as any)
      .eq('provider_id', pid)
      .select('*')
      .single();
    if (updateErr) throw updateErr;
    return normalizeDbRowToPublic(updated as BankAccountDbRow);
  }

  const id = randomUUID();
  const { data: inserted, error: insertErr } = await supabase
    .from(BANK_ACCOUNTS_TABLE)
    .insert({
      id,
      provider_id: pid,
      account_name,
      account_number,
      routing_number,
      bank_name,
      account_type,
      status: 'active',
    } as any)
    .select('*')
    .single();
  if (insertErr) throw insertErr;
  return normalizeDbRowToPublic(inserted as BankAccountDbRow);
}

/**
 * Get bank account for a provider
 */
export async function getBankAccount(providerId: string): Promise<BankAccount | null> {
  const pid = String(providerId || '').trim();
  if (!pid) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(BANK_ACCOUNTS_TABLE)
    .select('*')
    .eq('provider_id', pid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as BankAccountDbRow;
  const normalized = normalizeDbRowToPublic(row);
  return normalized.status === 'active' ? normalized : null;
}

/**
 * Get bank account for display (same as getBankAccount, but kept for backward compatibility)
 */
export async function getBankAccountForDisplay(providerId: string): Promise<BankAccount | null> {
  return getBankAccount(providerId);
}

/**
 * Delete/disconnect bank account for a provider
 * Marks account as disconnected rather than deleting it
 */
export async function deleteBankAccount(providerId: string): Promise<boolean> {
  const pid = String(providerId || '').trim();
  if (!pid) return false;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(BANK_ACCOUNTS_TABLE)
    .update({ status: 'disconnected' } as any)
    .eq('provider_id', pid)
    .select('provider_id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Admin helper: list bank accounts for masking / investigation.
 * Returns masked metadata only.
 */
export async function listBankAccounts(): Promise<BankAccount[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(BANK_ACCOUNTS_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => normalizeDbRowToPublic(row as BankAccountDbRow));
}

export async function findProviderIdsByBankAccountLast4(last4: string): Promise<string[]> {
  const q = String(last4 || '').replace(/\D/g, '').slice(-4);
  if (!q) return [];
  const supabase = getSupabaseAdmin();

  // Best-effort: use ends-with match; DB may store account numbers without whitespace.
  const { data, error } = await supabase
    .from(BANK_ACCOUNTS_TABLE)
    .select('provider_id, account_number, status')
    .like('account_number', `%${q}`)
    .limit(50);
  if (error) throw error;

  return (data ?? [])
    .filter((r: any) => String(r?.status || 'active').toLowerCase() === 'active')
    .filter((r: any) => toLast4(r?.account_number) === q)
    .map((r: any) => String(r?.provider_id || '').trim())
    .filter(Boolean);
}
