import { readFile } from 'fs/promises';
import path from 'path';

import { getUsers } from '@/lib/auth/storage';
import { getProviders } from '@/lib/providers/storage';
import type { User } from '@/lib/auth/types';
import type { ProviderProfile } from '@/lib/models/types';
import { listAllPayoutRequests, type PayoutRequest } from '@/lib/payouts/payout-requests.server';
import AdminPayoutsClient from '@/components/admin/AdminPayoutsClient';

type BankAccountRow = {
  providerId: string;
  bankName: string;
  last4: string;
  accountType: string;
  connectedAt: string;
  status: string;
};

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

function isBankAccountRow(value: unknown): value is BankAccountRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.providerId === 'string' &&
    typeof value.bankName === 'string' &&
    typeof value.last4 === 'string' &&
    typeof value.accountType === 'string' &&
    typeof value.connectedAt === 'string' &&
    typeof value.status === 'string'
  );
}

async function readBankAccounts(): Promise<BankAccountRow[]> {
  try {
    const p = path.join(process.cwd(), 'data', 'bank-accounts.json');
    const raw = await readFile(p, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBankAccountRow);
  } catch {
    return [];
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

function normalizePayoutMethod(raw: unknown): 'wise' | 'paypal' | 'zelle' | 'bank' | null {
  const m = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!m) return null;
  if (m === 'wise') return 'wise';
  if (m === 'paypal' || m === 'pay pal') return 'paypal';
  if (m === 'zelle') return 'zelle';
  if (m === 'bank' || m === 'bank_transfer' || m === 'bank transfer' || m === 'wire' || m === 'ach') return 'bank';
  return null;
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
  if (normalized === 'wise') return details.wiseEmail ? `Wise • ${details.wiseEmail}` : undefined;
  if (normalized === 'paypal') return details.paypalEmail ? `PayPal • ${details.paypalEmail}` : undefined;
  if (normalized === 'zelle') return details.zelleContact ? `Zelle • ${details.zelleContact}` : undefined;
  if (normalized === 'bank') {
    const bank = details.bankName ? details.bankName : '';
    const last4 = details.hasBankAccountNumber && details.bankAccountNumberLast4 ? details.bankAccountNumberLast4 : '';
    if (bank && last4) return `${bank} •••• ${last4}`;
    if (bank) return bank;
    if (last4) return `•••• ${last4}`;
  }
  return undefined;
}

export default async function AdminPayoutsPage() {
  const [users, providers, bankAccounts, payoutRequests] = await Promise.all([
    getUsers(),
    getProviders(),
    readBankAccounts(),
    listAllPayoutRequests(),
  ]);

  const userById = new Map<string, User>((users || []).map((u) => [u.id, u]));
  const providerByUserId = new Map<string, ProviderProfile>((providers || []).map((p) => [p.userId, p]));
  const bankByProviderId = new Map<string, BankAccountRow>();
  for (const b of bankAccounts) {
    if (b?.status === 'active') bankByProviderId.set(b.providerId, b);
  }

  const enriched: Array<
    PayoutRequest & {
      providerName: string;
      providerEmail: string;
      payoutMethod?: string;
      payoutDestination?: string;
    }
  > = (payoutRequests || []).map((pr: PayoutRequest) => {
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
      payoutDestinationLabelFromProvider(payoutDetails) ||
      bankDestination;

    return {
      ...pr,
      providerName: u?.name || u?.email || providerId,
      providerEmail: u?.email || '',
      payoutMethod,
      // SECURITY/UX: Keep the table masked; fetch full details on-demand in an admin-only API route.
      payoutDestination,
    };
  });

  return <AdminPayoutsClient initialPayoutRequests={enriched} />;
}

