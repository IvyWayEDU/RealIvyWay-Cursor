/**
 * Earnings Credits Store (source-of-truth)
 *
 * Production: Supabase tables
 * - public.provider_earnings_credits (idempotent by session_id)
 * - public.provider_earnings_balances (available/pending/withdrawn)
 *
 * Local/dev fallback: JSON files under /data (best-effort).
 */

import path from 'path';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { getProviderEarningsBalance, updateProviderEarningsBalance } from '@/lib/earnings/balances.server';

export interface Credit {
  id: string;
  providerId: string;
  sessionId: string;
  amountCents: number;
  createdAt: string;
}

const CREDITS_FILE = path.join(process.cwd(), 'data', 'earnings-credits.json');
const BALANCES_FILE = path.join(process.cwd(), 'data', 'provider-earnings.json'); // legacy fallback only

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

type ProviderEarningsBalances = Record<
  string,
  {
    balanceCents: number;
    updatedAt: string;
  }
>;

function hasSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type CreditRow = {
  id: string | null;
  provider_id: string | null;
  session_id: string | null;
  amount_cents: number | null;
  created_at: string | null;
};

function rowToCredit(row: CreditRow): Credit | null {
  const id = String(row?.id || '').trim();
  const providerId = String(row?.provider_id || '').trim();
  const sessionId = String(row?.session_id || '').trim();
  if (!id || !providerId || !sessionId) return null;
  const amountCents = Math.max(0, Math.floor(Number(row?.amount_cents || 0)));
  const createdAt = String(row?.created_at || new Date().toISOString());
  return { id, providerId, sessionId, amountCents, createdAt };
}

/**
 * Read all credits from JSON file
 */
export async function readCredits(): Promise<Credit[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('provider_earnings_credits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as any as CreditRow[]) : [];
    return rows.map(rowToCredit).filter(Boolean) as Credit[];
  }

  if (FS_DISABLED_IN_PROD) return [];
  try {
    const fsp = await import('fs/promises');
    const data = await fsp.readFile(CREDITS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function readBalances(): Promise<ProviderEarningsBalances> {
  if (FS_DISABLED_IN_PROD) return {};
  try {
    const fsp = await import('fs/promises');
    const data = await fsp.readFile(BALANCES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return (parsed && typeof parsed === 'object') ? (parsed as ProviderEarningsBalances) : {};
  } catch {
    return {};
  }
}

async function writeBalances(balances: ProviderEarningsBalances): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dataDir = path.dirname(BALANCES_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dataDir, { recursive: true });
  } catch (error: any) {
    return;
  }
  try {
    const fsp = await import('fs/promises');
    await fsp.writeFile(BALANCES_FILE, JSON.stringify(balances, null, 2), 'utf-8');
  } catch {
    return;
  }
}

/**
 * Write credits to JSON file
 */
async function writeCredits(credits: Credit[]): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  // Ensure data directory exists
  const dataDir = path.dirname(CREDITS_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dataDir, { recursive: true });
  } catch {
    return;
  }
  
  try {
    const fsp = await import('fs/promises');
    await fsp.writeFile(CREDITS_FILE, JSON.stringify(credits, null, 2), 'utf-8');
  } catch {
    return;
  }
}

/**
 * Check if a credit already exists for a session
 */
export async function creditExistsForSession(sessionId: string): Promise<boolean> {
  const sid = String(sessionId || '').trim();
  if (!sid) return false;

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('provider_earnings_credits')
      .select('id')
      .eq('session_id', sid)
      .limit(1);
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  }

  const credits = await readCredits();
  return credits.some((credit) => credit.sessionId === sid);
}

/**
 * Add a credit for a session (idempotent by sessionId)
 * If credit already exists, returns without changing anything.
 */
export async function addCreditForSession(args: {
  providerId: string;
  sessionId: string;
  amountCents: number;
}): Promise<void> {
  const { providerId, sessionId, amountCents } = args;
  const pid = String(providerId || '').trim();
  const sid = String(sessionId || '').trim();
  const cents = Math.max(0, Math.floor(Number(amountCents || 0)));
  if (!pid || !sid || cents <= 0) return;
  
  // Check if credit already exists
  const exists = await creditExistsForSession(sid);
  if (exists) {
    console.log('[EARNINGS] already credited', { sessionId: sid });
    return;
  }

  const nowISO = new Date().toISOString();

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    // Idempotent insert (guarded by pre-check and DB unique index on session_id).
    const { error } = await supabase.from('provider_earnings_credits').insert({
      id: `credit_${sid}`,
      provider_id: pid,
      session_id: sid,
      amount_cents: cents,
      created_at: nowISO,
    } as any);
    // If a concurrent insert happened, treat as success.
    if (error && !String((error as any)?.code || '').includes('23505')) throw error;

    // Mirror credit into provider balances (available_cents).
    // Balance fields are non-negative; this is a pure increment.
    const b = await getProviderEarningsBalance(pid);
    await updateProviderEarningsBalance({
      providerId: pid,
      availableCents: Math.max(0, Math.floor((b.availableCents || 0) + cents)),
      pendingCents: b.pendingCents || 0,
      withdrawnCents: b.withdrawnCents || 0,
    });

    console.log('[EARNINGS] credited session (supabase)', { sessionId: sid, providerId: pid, amountCents: cents });
    return;
  }

  // Local/dev fallback: JSON files.
  if (FS_DISABLED_IN_PROD) return;

  const credit: Credit = {
    id: `${sid}-credit`,
    providerId: pid,
    sessionId: sid,
    amountCents: cents,
    createdAt: nowISO,
  };

  const credits = await readCredits();
  credits.push(credit);
  await writeCredits(credits);

  const balances = await readBalances();
  const prev = balances[pid]?.balanceCents ?? 0;
  balances[pid] = {
    balanceCents: Math.max(0, Math.floor(prev + cents)),
    updatedAt: nowISO,
  };
  await writeBalances(balances);

  console.log('[EARNINGS] credited session (fs)', { sessionId: sid, providerId: pid, amountCents: cents });
}

