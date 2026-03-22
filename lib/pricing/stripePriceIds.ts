import { PricingKey } from './catalog';
import path from 'path';

/**
 * Stripe price id lookup.
 *
 * We intentionally do NOT infer prices from UI or amounts; we always choose
 * the Stripe Price ID by (service_type, plan, duration_minutes) -> PricingKey.
 *
 * Provide as a JSON map in env:
 *   STRIPE_PRICE_IDS_JSON='{"tutoring_single":"price_...","tutoring_monthly":"price_...","counseling_single":"price_...","counseling_monthly":"price_...","testprep_single":"price_...","testprep_monthly":"price_...","virtual_tour_single":"price_...","ai_basic_monthly":"price_...","ai_pro_monthly":"price_...","ai_pro_yearly":"price_..."}'
 */
const REQUIRED_ENV_KEYS = [
  'tutoring_single',
  'tutoring_monthly',
  'counseling_single',
  'counseling_monthly',
  'testprep_single',
  'testprep_monthly',
  'virtual_tour_single',
  'ai_basic_monthly',
  'ai_pro_monthly',
  'ai_pro_yearly',
] as const;

type StripeEnvPricingKey = (typeof REQUIRED_ENV_KEYS)[number];

export function toStripePriceEnvKey(pricing_key: PricingKey): StripeEnvPricingKey {
  switch (pricing_key) {
    case 'tutoring_single':
      return 'tutoring_single';
    case 'tutoring_monthly':
      return 'tutoring_monthly';
    case 'counseling_single':
      return 'counseling_single';
    case 'counseling_monthly':
      return 'counseling_monthly';
    case 'test_prep_single':
      return 'testprep_single';
    case 'test_prep_monthly':
      return 'testprep_monthly';
    case 'virtual_tour_single':
      return 'virtual_tour_single';
    case 'ivyway_ai_basic_monthly':
      return 'ai_basic_monthly';
    case 'ivyway_ai_pro_monthly':
      return 'ai_pro_monthly';
    case 'ivyway_ai_pro_yearly':
      return 'ai_pro_yearly';
  }
}

let cachedMap: Record<StripeEnvPricingKey, string> | null = null;
type StripePriceIdMapSource = 'env' | 'dev_fallback';
let cachedSource: StripePriceIdMapSource | null = null;
let didLogMapKeys = false;

function tryLoadDevFallbackStripePriceIdMapRaw(): string | null {
  // Only allow fallback in non-production environments.
  if (process.env.NODE_ENV === 'production') return null;

  try {
    // Use require() so this module remains compatible with environments that
    // might not bundle Node fs in production builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');

    const candidates = [
      // Preferred location
      path.join(process.cwd(), 'data', 'stripe-price-ids.local.json'),
      // Alternate/legacy locations (safe to keep)
      path.join(process.cwd(), 'stripe-price-ids.local.json'),
    ];

    for (const abs of candidates) {
      if (fs.existsSync(abs)) {
        const raw = fs.readFileSync(abs, 'utf8');
        if (typeof raw === 'string' && raw.trim()) return raw;
      }
    }
  } catch {
    // Ignore; we'll fall back to throwing the normal "Missing env var" error below.
  }

  return null;
}

function loadStripePriceIdMapFromEnv(): Record<StripeEnvPricingKey, string> {
  if (cachedMap) return cachedMap;

  const envRaw = process.env.STRIPE_PRICE_IDS_JSON;
  const fallbackRaw = envRaw ? null : tryLoadDevFallbackStripePriceIdMapRaw();
  const raw = envRaw || fallbackRaw;
  if (!raw) {
    throw new Error(
      'Missing STRIPE_PRICE_IDS_JSON env var (JSON map from pricing key → Stripe price id). For local dev you can alternatively create data/stripe-price-ids.local.json.'
    );
  }

  cachedSource = envRaw ? 'env' : 'dev_fallback';

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid STRIPE_PRICE_IDS_JSON (must be valid JSON)');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid STRIPE_PRICE_IDS_JSON (must be a JSON object)');
  }

  const obj = parsed as Record<string, unknown>;
  const missing: string[] = [];
  const out: Partial<Record<StripeEnvPricingKey, string>> = {};

  for (const k of REQUIRED_ENV_KEYS) {
    const v = obj[k];
    if (typeof v !== 'string' || !v.trim()) {
      missing.push(k);
      continue;
    }
    const trimmed = v.trim();
    // Stripe Price IDs look like `price_...` (not `prod_...`).
    if (!trimmed.startsWith('price_')) {
      throw new Error(
        `Invalid STRIPE_PRICE_IDS_JSON value for key=${k}. Expected a Stripe Price ID starting with "price_", got: ${trimmed}`
      );
    }
    out[k] = trimmed;
  }

  if (missing.length > 0) {
    throw new Error(
      `STRIPE_PRICE_IDS_JSON is missing required keys: ${missing.join(', ')}`
    );
  }

  cachedMap = out as Record<StripeEnvPricingKey, string>;
  return cachedMap;
}

export function getStripePriceIdForPricingKey(pricing_key: PricingKey): string {
  const envKey = toStripePriceEnvKey(pricing_key);
  const map = loadStripePriceIdMapFromEnv();
  const id = map[envKey];
  if (typeof id !== 'string' || !id.trim()) {
    // Should not happen because loadStripePriceIdMapFromEnv validates required keys
    throw new Error(`Missing Stripe price id for pricing_key=${pricing_key} (envKey=${envKey})`);
  }
  return id.trim();
}

export function getStripePriceIdMapDebugInfo(): {
  source: StripePriceIdMapSource;
  keys: StripeEnvPricingKey[];
} {
  const map = loadStripePriceIdMapFromEnv();
  // loadStripePriceIdMapFromEnv always sets cachedSource if it succeeds
  const source = cachedSource || 'env';
  return {
    source,
    keys: Object.keys(map).sort() as StripeEnvPricingKey[],
  };
}

export function debugLogStripePriceIdMapKeysOnce(logPrefix = 'STRIPE_PRICE_IDS'): void {
  if (didLogMapKeys) return;
  didLogMapKeys = true;
  try {
    const info = getStripePriceIdMapDebugInfo();
    console.log(`${logPrefix} map source:`, info.source);
    console.log(`${logPrefix} map keys:`, info.keys);
  } catch (e) {
    console.warn(`${logPrefix} map load failed:`, e);
  }
}


