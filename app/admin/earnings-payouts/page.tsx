import { getUsers } from '@/lib/auth/storage';
import { getSessions } from '@/lib/sessions/storage';
import { readCredits } from '@/lib/earnings/credits.server';
import AdminEarningsClient from '@/components/admin/AdminEarningsClient';
import { listPendingPayoutRequests, type PayoutRequest } from '@/lib/payouts/payout-requests.server';
import { getProviders } from '@/lib/providers/storage';
import type { User } from '@/lib/auth/types';
import type { ProviderProfile } from '@/lib/models/types';
import { listBankAccounts, type BankAccount } from '@/lib/payouts/bank-account-storage';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

type Balances = Record<string, { availableCents: number; pendingCents: number; withdrawnCents: number; updatedAt: string }>;

type PayoutDetailsSummary = {
  payoutMethod?: string;
  wiseEmail?: string;
  paypalEmail?: string;
  zelleContact?: string;
  bankName?: string;
  bankCountry?: string;
  hasBankAccountNumber?: boolean;
  bankAccountNumberLast4?: string | null;
  hasBankRoutingNumber?: boolean;
  bankRoutingNumberLast4?: string | null;
  bankRoutingNumber?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePayoutMethod(raw: unknown): 'wise' | 'paypal' | 'zelle' | 'bank' | null {
  const m = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!m) return null;
  if (m === 'wise') return 'wise';
  if (m === 'paypal' || m === 'pay pal') return 'paypal';
  if (m === 'zelle') return 'zelle';
  if (m === 'bank' || m === 'bank_transfer' || m === 'bank transfer' || m === 'wire' || m === 'ach') return 'bank';
  return null;
}

async function readProviderEarningsBalances(): Promise<Balances> {
  // Primary: Supabase balances table (production-safe).
  try {
    const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (hasSupabase) {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from('provider_earnings_balances').select('*');
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as any[]) : [];
      const out: Balances = {};
      for (const r of rows) {
        const providerId = String(r?.provider_id || '').trim();
        if (!providerId) continue;
        out[providerId] = {
          availableCents: Math.max(0, Math.floor(Number(r?.available_cents || 0))),
          pendingCents: Math.max(0, Math.floor(Number(r?.pending_cents || 0))),
          withdrawnCents: Math.max(0, Math.floor(Number(r?.withdrawn_cents || 0))),
          updatedAt: String(r?.updated_at || r?.created_at || new Date().toISOString()),
        };
      }
      return out;
    }
  } catch {
    // fall through to local fallback
  }

  // Local fallback: legacy JSON file (dev only).
  if (process.env.NODE_ENV === 'production') return {};
  try {
    const fsp = await import('fs/promises');
    const p = (await import('path')).default.join(process.cwd(), 'data', 'provider-earnings.json');
    const raw = await fsp.readFile(p, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: Balances = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!isRecord(v)) continue;
      const balanceCents = Number((v as any).balanceCents);
      const updatedAt = typeof (v as any).updatedAt === 'string' ? (v as any).updatedAt : '';
      if (!Number.isFinite(balanceCents) || !updatedAt) continue;
      out[k] = { availableCents: Math.floor(balanceCents), pendingCents: 0, withdrawnCents: 0, updatedAt };
    }
    return out;
  } catch {
    return {};
  }
}

function last4(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length < 4) return null;
  return v.slice(-4);
}

function toPayoutDetailsSummary(provider: ProviderProfile): PayoutDetailsSummary {
  const bankAccountLast4 = last4(provider?.bankAccountNumber);
  const bankRoutingLast4 = last4(provider?.bankRoutingNumber);
  return {
    payoutMethod: typeof provider?.payoutMethod === 'string' ? provider.payoutMethod : undefined,
    wiseEmail: typeof provider?.wiseEmail === 'string' ? provider.wiseEmail : undefined,
    paypalEmail: typeof provider?.paypalEmail === 'string' ? provider.paypalEmail : undefined,
    zelleContact: typeof provider?.zelleContact === 'string' ? provider.zelleContact : undefined,
    bankName: typeof provider?.bankName === 'string' ? provider.bankName : undefined,
    bankCountry: typeof provider?.bankCountry === 'string' ? provider.bankCountry : undefined,
    hasBankAccountNumber: !!bankAccountLast4,
    bankAccountNumberLast4: bankAccountLast4,
    hasBankRoutingNumber: !!bankRoutingLast4,
    bankRoutingNumberLast4: bankRoutingLast4,
    bankRoutingNumber: typeof provider?.bankRoutingNumber === 'string' ? provider.bankRoutingNumber : undefined,
  };
}

function payoutMethodLabelFromProvider(details?: PayoutDetailsSummary): string | undefined {
  if (!details) return undefined;
  const normalized = normalizePayoutMethod(details.payoutMethod);
  if (normalized === 'wise') return 'Wise';
  if (normalized === 'paypal') return 'PayPal';
  if (normalized === 'zelle') return 'Zelle';
  if (normalized === 'bank') return 'Bank Transfer';
  const raw = typeof details.payoutMethod === 'string' ? details.payoutMethod.trim() : '';
  return raw || undefined;
}

function payoutDestinationLabelFromProvider(details?: PayoutDetailsSummary): string | undefined {
  if (!details) return undefined;
  const normalized = normalizePayoutMethod(details.payoutMethod);
  if (normalized === 'wise') return details.wiseEmail ? details.wiseEmail : undefined;
  if (normalized === 'paypal') return details.paypalEmail ? details.paypalEmail : undefined;
  if (normalized === 'zelle') return details.zelleContact ? details.zelleContact : undefined;
  if (normalized === 'bank') {
    const bank = details.bankName ? details.bankName : '';
    const last4 = details.hasBankAccountNumber && details.bankAccountNumberLast4 ? details.bankAccountNumberLast4 : '';
    if (bank && last4) return `${bank} •••• ${last4}`;
    if (bank) return bank;
    if (last4) return `•••• ${last4}`;
  }
  return undefined;
}

export default async function AdminEarningsPayoutsPage() {
  const [users, sessions, credits, bankAccounts, balances, payoutRequests, providers] = await Promise.all([
    getUsers(),
    getSessions(),
    readCredits(),
    listBankAccounts(),
    readProviderEarningsBalances(),
    listPendingPayoutRequests(),
    getProviders(),
  ]);

  const userById = new Map<string, User>(users.map((u) => [u.id, u]));
  const providerByUserId = new Map<string, ProviderProfile>(providers.map((p) => [p.userId, p]));
  const bankByProviderId = new Map<string, BankAccount>();
  for (const b of bankAccounts) {
    if (b?.status === 'active') bankByProviderId.set(b.providerId, b);
  }

  const enrichedPayoutRequests: Array<
    PayoutRequest & {
      providerName: string;
      providerEmail: string;
      payoutDetails?: PayoutDetailsSummary;
      payoutMethod?: string;
      payoutDestination?: string;
    }
  > = payoutRequests.map((pr) => {
    const providerId = String(pr.providerId || '');
    const u = userById.get(providerId);
    const provider = providerByUserId.get(providerId);
    const payoutDetails = provider ? toPayoutDetailsSummary(provider) : undefined;
    const bank = bankByProviderId.get(providerId);
    const bankDestination = bank ? `${bank.bankName} •••• ${bank.last4}` : undefined;

    // Prefer request snapshot; otherwise fallback to provider profile; otherwise fallback to bank metadata.
    const payoutMethod =
      (typeof pr.payoutMethod === 'string' && pr.payoutMethod.trim()) ||
      payoutMethodLabelFromProvider(payoutDetails) ||
      (bankDestination ? 'Bank Transfer' : undefined);
    const payoutDestination =
      (typeof pr.payoutDestinationMasked === 'string' && pr.payoutDestinationMasked.trim()) ||
      (typeof pr.payoutDestination === 'string' && pr.payoutDestination.trim()) ||
      payoutDestinationLabelFromProvider(payoutDetails) ||
      bankDestination;

    return {
      ...pr,
      providerName: u?.name || u?.email || providerId,
      providerEmail: u?.email || '',
      payoutDetails,
      payoutMethod,
      payoutDestination,
    };
  });

  return (
    <AdminEarningsClient
      initialUsers={users}
      initialSessions={sessions}
      initialCredits={credits}
      initialBankAccounts={bankAccounts}
      initialBalances={balances}
      initialPayoutRequests={enrichedPayoutRequests}
    />
  );
}


