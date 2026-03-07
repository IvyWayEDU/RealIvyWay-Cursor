// NOTE: Use a relative import so `tsconfig.scripts.json` (used for scripts) can compile without Next.js path aliases.
import { getProviderPayout } from '../payouts/getProviderPayout';

export type ServiceType =
  | 'tutoring'
  | 'counseling'
  | 'test_prep'
  | 'virtual_tour'
  | 'ivyway_ai';

export type Plan = 'single' | 'monthly' | 'yearly';

export type PricingKey =
  | 'tutoring_single'
  | 'tutoring_monthly'
  | 'counseling_single'
  | 'counseling_monthly'
  | 'test_prep_single'
  | 'test_prep_monthly'
  | 'virtual_tour_single'
  | 'ivyway_ai_basic_monthly'
  | 'ivyway_ai_pro_monthly'
  | 'ivyway_ai_pro_yearly';

export type CatalogItem = Readonly<{
  key: PricingKey;
  service_type: ServiceType;
  plan: Plan;
  duration_minutes: 60 | null;
  sessions_per_purchase: number; // For bundles, this is the number of sessions created/credited.
  purchase_price_cents: number; // Amount Stripe must charge for checkout/subscription purchase.
}>;

/**
 * SOURCE OF TRUTH PRICING (integer cents only)
 * This is the ONLY valid customer pricing configuration across the platform.
 *
 * Provider payout MUST NOT be hardcoded here. Provider payout is centralized in:
 *   `lib/payouts/getProviderPayout.ts`
 */
export const PRICING_CATALOG: Readonly<Record<PricingKey, CatalogItem>> = {
  // Tutoring (1 hour)
  tutoring_single: {
    key: 'tutoring_single',
    service_type: 'tutoring',
    plan: 'single',
    duration_minutes: null,
    sessions_per_purchase: 1,
    purchase_price_cents: 6900,
  },
  tutoring_monthly: {
    key: 'tutoring_monthly',
    service_type: 'tutoring',
    plan: 'monthly',
    duration_minutes: null,
    sessions_per_purchase: 4,
    purchase_price_cents: 24900,
  },

  // College counseling
  counseling_single: {
    key: 'counseling_single',
    service_type: 'counseling',
    plan: 'single',
    duration_minutes: 60,
    sessions_per_purchase: 1,
    purchase_price_cents: 8900,
  },
  counseling_monthly: {
    key: 'counseling_monthly',
    service_type: 'counseling',
    plan: 'monthly',
    duration_minutes: 60,
    sessions_per_purchase: 4,
    purchase_price_cents: 29900,
  },

  // Test prep (1 hour)
  test_prep_single: {
    key: 'test_prep_single',
    service_type: 'test_prep',
    plan: 'single',
    duration_minutes: null,
    sessions_per_purchase: 1,
    purchase_price_cents: 14900,
  },
  test_prep_monthly: {
    key: 'test_prep_monthly',
    service_type: 'test_prep',
    plan: 'monthly',
    duration_minutes: null,
    sessions_per_purchase: 4,
    purchase_price_cents: 49900,
  },

  // Virtual college tours
  virtual_tour_single: {
    key: 'virtual_tour_single',
    service_type: 'virtual_tour',
    plan: 'single',
    duration_minutes: null,
    sessions_per_purchase: 1,
    purchase_price_cents: 12400,
  },

  // IvyWay AI (platform keeps 100%)
  ivyway_ai_basic_monthly: {
    key: 'ivyway_ai_basic_monthly',
    service_type: 'ivyway_ai',
    plan: 'monthly',
    duration_minutes: null,
    sessions_per_purchase: 1,
    purchase_price_cents: 1499,
  },
  ivyway_ai_pro_monthly: {
    key: 'ivyway_ai_pro_monthly',
    service_type: 'ivyway_ai',
    plan: 'monthly',
    duration_minutes: null,
    sessions_per_purchase: 1,
    purchase_price_cents: 2999,
  },
  ivyway_ai_pro_yearly: {
    key: 'ivyway_ai_pro_yearly',
    service_type: 'ivyway_ai',
    plan: 'yearly',
    duration_minutes: null,
    sessions_per_purchase: 1,
    purchase_price_cents: 24999,
  },
} as const;

export function formatUsdFromCents(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.floor(cents) : 0;
  return `$${(safe / 100).toFixed(2)}`;
}

function assertIntCents(v: number, label: string): void {
  if (!Number.isFinite(v) || Math.floor(v) !== v || v < 0) {
    throw new Error(`Invalid cents for ${label}: ${v}`);
  }
}

export function getCatalogItemByKey(key: PricingKey): CatalogItem {
  const item = PRICING_CATALOG[key];
  if (!item) throw new Error(`Unknown pricing key: ${key}`);
  return item;
}

export function getPricingKey(args: {
  service_type: ServiceType;
  plan: Plan;
  duration_minutes?: number | null;
}): PricingKey {
  const { service_type, plan } = args;
  const duration = args.duration_minutes ?? null;

  if (service_type === 'tutoring') {
    if (plan === 'single') return 'tutoring_single';
    if (plan === 'monthly') return 'tutoring_monthly';
  }

  if (service_type === 'test_prep') {
    if (plan === 'single') return 'test_prep_single';
    if (plan === 'monthly') return 'test_prep_monthly';
  }

  if (service_type === 'virtual_tour') {
    if (plan === 'single') return 'virtual_tour_single';
  }

  if (service_type === 'counseling') {
    if (plan === 'monthly') return 'counseling_monthly';
    if (plan === 'single') {
      // Counseling is 60 minutes only (duration selection is not allowed).
      if (duration == null || duration === 60) return 'counseling_single';
      throw new Error('Counseling single is 60 minutes only (duration_minutes must be 60)');
    }
  }

  if (service_type === 'ivyway_ai') {
    if (plan === 'monthly' && duration == null) {
      // Caller must disambiguate basic vs pro; defaulting is forbidden.
      throw new Error('IvyWay AI monthly requires an explicit SKU key (basic/pro) elsewhere');
    }
    if (plan === 'yearly') return 'ivyway_ai_pro_yearly';
  }

  throw new Error(`Unsupported pricing lookup: service_type=${service_type} plan=${plan} duration_minutes=${duration}`);
}

export function getSessionPricingCents(args: {
  service_type: ServiceType;
  plan: Plan;
  duration_minutes?: 60 | null;
}): {
  pricing_key: PricingKey;
  purchase_price_cents: number;
  sessions_per_purchase: number;
  session_price_cents: number;
  provider_payout_cents: number;
  ivyway_take_cents: number;
} {
  const pricing_key = getPricingKey(args);
  const item = getCatalogItemByKey(pricing_key);

  const purchase_price_cents = Math.floor(item.purchase_price_cents);
  const sessions_per_purchase = Math.floor(item.sessions_per_purchase);

  assertIntCents(purchase_price_cents, `${pricing_key}.purchase_price_cents`);
  assertIntCents(sessions_per_purchase, `${pricing_key}.sessions_per_purchase`);

  if (sessions_per_purchase <= 0) {
    throw new Error(`Invalid sessions_per_purchase for ${pricing_key}: ${sessions_per_purchase}`);
  }

  // Bundle-safe: must divide evenly (these numbers are chosen to be exact).
  if (purchase_price_cents % sessions_per_purchase !== 0) {
    throw new Error(`purchase_price_cents not divisible by sessions_per_purchase for ${pricing_key}`);
  }

  const session_price_cents = purchase_price_cents / sessions_per_purchase;
  const payoutServiceType = item.service_type === 'counseling' ? 'college_counseling' : item.service_type;
  const provider_payout_cents = Math.max(0, Math.floor(getProviderPayout(payoutServiceType) * 100));
  assertIntCents(provider_payout_cents, `${pricing_key}.provider_payout_cents`);
  const ivyway_take_cents = Math.max(0, Math.floor(session_price_cents - provider_payout_cents));

  if (ivyway_take_cents < 0) {
    throw new Error(`Negative ivyway_take_cents for ${pricing_key}`);
  }
  if (provider_payout_cents + ivyway_take_cents !== session_price_cents) {
    throw new Error(`Per-session take mismatch for ${pricing_key}`);
  }

  return {
    pricing_key,
    purchase_price_cents,
    sessions_per_purchase,
    session_price_cents,
    provider_payout_cents,
    ivyway_take_cents,
  };
}

export function getProviderPayoutCents(
  service_type: ServiceType,
  duration_minutes: 60 | null,
  plan: Plan
): number {
  void duration_minutes; // payout is flat per session; duration_minutes is irrelevant for payout
  void plan; // payout is flat per session; plan is irrelevant for payout
  const payoutServiceType = service_type === 'counseling' ? 'college_counseling' : service_type;
  return Math.max(0, Math.floor(getProviderPayout(payoutServiceType) * 100));
}


