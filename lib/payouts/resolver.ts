/**
 * Payout Resolver
 * 
 * Single source of truth for provider payout and platform fee calculations.
 * Customer pricing delegates to `lib/pricing/catalog.ts` (amounts in cents).
 * Provider payout delegates to `lib/payouts/getProviderPayout.ts` (flat per-session).
 * 
 * Provider payout NEVER includes tax and NEVER changes after payment.
 * Provider payout is independent of referral credits or discounts.
 */

export type ServiceKey =
  | 'tutoring_single'
  | 'tutoring_monthly'
  | 'test_prep_single'
  | 'test_prep_monthly'
  | 'counseling_single'
  | 'counseling_monthly'
  | 'virtual_tour_single';

import { PRICING_CATALOG, PricingKey, getSessionPricingCents } from '@/lib/pricing/catalog';

function serviceKeyToPricingKey(serviceKey: ServiceKey): PricingKey {
  switch (serviceKey) {
    case 'tutoring_single':
      return 'tutoring_single';
    case 'tutoring_monthly':
      return 'tutoring_monthly';
    case 'test_prep_single':
      return 'test_prep_single';
    case 'test_prep_monthly':
      return 'test_prep_monthly';
    case 'counseling_single':
      return 'counseling_single';
    case 'counseling_monthly':
      return 'counseling_monthly';
    case 'virtual_tour_single':
      return 'virtual_tour_single';
  }
}

/**
 * Resolves payout amounts for a given serviceKey
 * 
 * @param serviceKey - The service key (e.g., 'tutoring_single')
 * @param baseAmountCents - The base amount in cents (for validation)
 * @returns Payout breakdown with provider payout and platform fee
 * @throws Error if serviceKey is invalid or if providerPayout + platformFee !== baseAmount
 */
export function resolvePayout(
  serviceKey: string,
  baseAmountCents: number
): {
  providerPayoutCents: number;
  platformFeeCents: number;
} {
  // Validate serviceKey
  if (!serviceKey || typeof serviceKey !== 'string') {
    throw new Error(`Invalid serviceKey: ${serviceKey}`);
  }

  const key = serviceKey as ServiceKey;
  const pricingKey = ((): PricingKey => {
    try {
      return serviceKeyToPricingKey(key);
    } catch {
      throw new Error(
        `Invalid serviceKey: "${serviceKey}". ` +
        `Valid keys: ${getValidServiceKeys().join(', ')}`
      );
    }
  })();

  const item = PRICING_CATALOG[pricingKey];
  if (!item) {
    throw new Error(
      `Missing pricing catalog item for pricingKey="${pricingKey}" (from serviceKey="${serviceKey}")`
    );
  }

  // Compute per-session payout + take (derived; payout is centralized in getProviderPayout()).
  const pricing = getSessionPricingCents({
    service_type: item.service_type,
    plan: item.plan,
    duration_minutes: item.duration_minutes,
  });
  const providerPayoutCents = pricing.provider_payout_cents * pricing.sessions_per_purchase;
  const platformFeeCents = pricing.ivyway_take_cents * pricing.sessions_per_purchase;

  // Safety check: providerPayout + platformFee must equal baseAmount
  const calculatedTotal = providerPayoutCents + platformFeeCents;
  
  if (calculatedTotal !== baseAmountCents) {
    throw new Error(
      `Payout calculation mismatch for serviceKey "${serviceKey}": ` +
      `providerPayoutCents (${providerPayoutCents}) + platformFeeCents (${platformFeeCents}) = ${calculatedTotal} ` +
      `but baseAmountCents = ${baseAmountCents}`
    );
  }

  return {
    providerPayoutCents,
    platformFeeCents,
  };
}

/**
 * Gets all valid service keys
 */
export function getValidServiceKeys(): ServiceKey[] {
  return [
    'tutoring_single',
    'tutoring_monthly',
    'test_prep_single',
    'test_prep_monthly',
    'counseling_single',
    'counseling_monthly',
    'virtual_tour_single',
  ];
}




