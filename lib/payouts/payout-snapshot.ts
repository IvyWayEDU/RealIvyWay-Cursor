import type { ProviderProfile } from '@/lib/models/types';

export type NormalizedPayoutMethod = 'wise' | 'paypal' | 'zelle' | 'bank' | 'stripe' | null;

export function normalizePayoutMethod(raw: unknown): NormalizedPayoutMethod {
  const m = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!m) return null;
  if (m === 'wise') return 'wise';
  if (m === 'paypal' || m === 'pay pal') return 'paypal';
  if (m === 'zelle') return 'zelle';
  if (m === 'bank' || m === 'bank_transfer' || m === 'bank transfer' || m === 'wire' || m === 'ach') return 'bank';
  if (m === 'stripe' || m === 'stripe connect') return 'stripe';
  return null;
}

export function payoutMethodLabel(method: NormalizedPayoutMethod): string | undefined {
  if (!method) return undefined;
  if (method === 'wise') return 'Wise';
  if (method === 'paypal') return 'PayPal';
  if (method === 'zelle') return 'Zelle';
  if (method === 'bank') return 'Bank Transfer';
  if (method === 'stripe') return 'Stripe';
  return undefined;
}

function cleanString(value: unknown): string | undefined {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v : undefined;
}

function last4(value: unknown): string | undefined {
  const v = cleanString(value);
  if (!v || v.length < 4) return undefined;
  return v.slice(-4);
}

export type PayoutRequestSnapshot = {
  payoutMethod?: string;
  payoutDestinationMasked?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankCountry?: string;
  accountHolderName?: string;
  wiseEmail?: string;
  paypalEmail?: string;
  zelleContact?: string;
};

/**
 * Build the snapshot we store on a payout request at creation-time.
 *
 * IMPORTANT:
 * - `payoutDestinationMasked` is the admin-table display string (human friendly + non-sensitive).
 * - The admin modal must use the full snapshot fields (bankAccountNumber, routing, etc), not this display string.
 */
export function buildPayoutRequestSnapshot(args: {
  provider: ProviderProfile | null;
  bankMeta?: { bankName?: string; last4?: string } | null;
}): PayoutRequestSnapshot {
  const provider = args.provider;
  const method = normalizePayoutMethod(provider?.payoutMethod);

  if (method === 'wise') {
    const wiseEmail = cleanString(provider?.wiseEmail);
    if (!wiseEmail) return {};
    return {
      payoutMethod: payoutMethodLabel(method),
      payoutDestinationMasked: `Wise • ${wiseEmail}`,
      wiseEmail,
    };
  }

  if (method === 'paypal') {
    const paypalEmail = cleanString(provider?.paypalEmail);
    if (!paypalEmail) return {};
    return {
      payoutMethod: payoutMethodLabel(method),
      payoutDestinationMasked: `PayPal • ${paypalEmail}`,
      paypalEmail,
    };
  }

  if (method === 'zelle') {
    const zelleContact = cleanString(provider?.zelleContact);
    if (!zelleContact) return {};
    return {
      payoutMethod: payoutMethodLabel(method),
      payoutDestinationMasked: `Zelle • ${zelleContact}`,
      zelleContact,
    };
  }

  if (method === 'bank') {
    const bankName = cleanString(provider?.bankName) || cleanString(args.bankMeta?.bankName);
    const bankAccountNumber = cleanString(provider?.bankAccountNumber)?.replace(/\s+/g, '');
    const bankRoutingNumber = cleanString(provider?.bankRoutingNumber)?.replace(/\s+/g, '');
    const bankCountry = cleanString(provider?.bankCountry)?.toUpperCase();
    const accountHolderName =
      cleanString((provider as any)?.accountHolderName) ||
      cleanString((provider as any)?.bankAccountHolderName) ||
      cleanString((provider as any)?.account_holder_name);

    const acctLast4 = last4(bankAccountNumber) || cleanString(args.bankMeta?.last4);
    const bankLabel = bankName || 'Bank';
    const destination = acctLast4 ? `${bankLabel} •••• ${acctLast4}` : bankLabel;

    return {
      payoutMethod: payoutMethodLabel(method),
      payoutDestinationMasked: destination,
      bankName: bankName || undefined,
      bankAccountNumber,
      bankRoutingNumber,
      bankCountry: bankCountry && bankCountry.length === 2 ? bankCountry : undefined,
      accountHolderName,
    };
  }

  return {};
}

