"use strict";
/**
 * One-time Stripe sync script: create Products + Prices for every PRICING_CATALOG purchase amount.
 *
 * - Uses integer cents only.
 * - Does NOT add platform-fee line items.
 * - Does NOT enable taxes/automatic tax.
 * - Does NOT enable coupons/discounts.
 *
 * Usage (run locally with network access):
 *   STRIPE_SECRET_KEY=sk_test_... node .scripts-build/scripts/stripe-rebuild-prices.js
 *
 * Output:
 *   Prints a JSON map suitable for STRIPE_PRICE_IDS_JSON env var.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stripe_1 = __importDefault(require("stripe"));
const catalog_1 = require("../lib/pricing/catalog");
const stripePriceIds_1 = require("../lib/pricing/stripePriceIds");
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
}
const stripe = new stripe_1.default(stripeKey, { apiVersion: '2026-02-25.clover' });
function pickTaxCodeIdByKeywords(codes, keywords) {
    const kw = keywords.map((k) => k.toLowerCase());
    const match = codes.find((c) => {
        const hay = `${c.name ?? ''} ${c.description ?? ''}`.toLowerCase();
        return kw.some((k) => hay.includes(k));
    });
    return match?.id;
}
async function resolveTaxCodes() {
    const fromEnv = {
        education: process.env.STRIPE_TAX_CODE_EDUCATION || undefined,
        digital: process.env.STRIPE_TAX_CODE_DIGITAL || undefined,
    };
    if (fromEnv.education && fromEnv.digital)
        return fromEnv;
    // If not explicitly configured, attempt best-effort discovery from Stripe's Tax Codes list.
    // This avoids hardcoding txcd_* IDs in the repo while still setting a meaningful category.
    const listed = await stripe.taxCodes.list({ limit: 100 });
    const codes = listed.data || [];
    return {
        education: fromEnv.education ??
            pickTaxCodeIdByKeywords(codes, ['education', 'tutoring', 'training', 'instruction', 'course']),
        digital: fromEnv.digital ??
            pickTaxCodeIdByKeywords(codes, ['digital', 'software', 'saas', 'electronically', 'online service']),
    };
}
function productNameForKey(key) {
    switch (key) {
        case 'tutoring_single':
            return 'Tutoring (Single, 1 hour)';
        case 'tutoring_monthly':
            return 'Tutoring (Monthly, 4 sessions)';
        case 'counseling_single':
            return 'College Counseling (Single, 60 min)';
        case 'counseling_monthly':
            return 'College Counseling (Monthly, 4x 60 min)';
        case 'test_prep_single':
            return 'Test Prep (Single, 1 hour)';
        case 'test_prep_monthly':
            return 'Test Prep (Monthly, 4 sessions)';
        case 'virtual_tour_single':
            return 'Virtual College Tour (Single)';
        case 'ivyway_ai_basic_monthly':
            return 'IvyWay AI (Basic, Monthly)';
        case 'ivyway_ai_pro_monthly':
            return 'IvyWay AI (Pro, Monthly)';
        case 'ivyway_ai_pro_yearly':
            return 'IvyWay AI (Pro, Yearly)';
    }
}
async function ensureProduct(key, taxCodes) {
    const name = productNameForKey(key);
    const isDigital = key.startsWith('ivyway_ai_');
    const tax_code = isDigital ? taxCodes.digital : taxCodes.education;
    // We use product metadata to keep it deterministic.
    const existing = await stripe.products.search({
        query: `metadata['ivyway_pricing_key']:'${key}'`,
        limit: 1,
    });
    if (existing.data.length > 0) {
        const prod = existing.data[0];
        // Best-effort: ensure tax_code is set correctly for Stripe Tax.
        if (tax_code && prod.tax_code !== tax_code) {
            await stripe.products.update(prod.id, { tax_code });
        }
        return prod.id;
    }
    const product = await stripe.products.create({
        name,
        metadata: { ivyway_pricing_key: key },
        ...(tax_code ? { tax_code } : {}),
    });
    return product.id;
}
async function ensurePrice(key, productId) {
    const item = catalog_1.PRICING_CATALOG[key];
    const amount = item.purchase_price_cents;
    // First, try to find an active price by lookup_key.
    const list = await stripe.prices.list({
        lookup_keys: [key],
        active: true,
        limit: 10,
    });
    // Subscriptions:
    // - IvyWay AI SKUs are subscriptions (monthly/yearly)
    // - Counseling monthly plan is a subscription billed monthly (grants 4 credits/month)
    const isSubscription = key.startsWith('ivyway_ai_') || key === 'counseling_monthly';
    const desiredInterval = key.endsWith('_yearly') ? 'year' : 'month';
    const match = list.data.find((p) => {
        if (p.unit_amount !== amount || p.currency !== 'usd')
            return false;
        if (p.tax_behavior !== 'exclusive')
            return false;
        if (isSubscription) {
            return p.type === 'recurring' && p.recurring?.interval === desiredInterval;
        }
        return p.type === 'one_time';
    });
    if (match)
        return match.id;
    const price = await stripe.prices.create({
        product: productId,
        currency: 'usd',
        unit_amount: amount,
        lookup_key: key,
        // Ensure tax is added on TOP of the listed base price (required for Stripe Tax).
        tax_behavior: 'exclusive',
        ...(isSubscription
            ? {
                recurring: {
                    interval: key.endsWith('_yearly') ? 'year' : 'month',
                    interval_count: 1,
                },
            }
            : {}),
        metadata: { ivyway_pricing_key: key },
    });
    // Deactivate any other active prices for this lookup key so Checkout always uses the tax-exclusive Price.
    for (const p of list.data) {
        if (p.id !== price.id) {
            try {
                await stripe.prices.update(p.id, { active: false });
            }
            catch {
                // ignore (best-effort cleanup)
            }
        }
    }
    return price.id;
}
async function main() {
    const out = {};
    const keys = Object.keys(catalog_1.PRICING_CATALOG);
    const taxCodes = await resolveTaxCodes();
    if (!taxCodes.education || !taxCodes.digital) {
        console.warn('[WARN] Could not resolve one or more Stripe Tax codes. Consider setting env vars STRIPE_TAX_CODE_EDUCATION and STRIPE_TAX_CODE_DIGITAL.', taxCodes);
    }
    for (const key of keys) {
        const productId = await ensureProduct(key, taxCodes);
        const priceId = await ensurePrice(key, productId);
        // Env format uses public env keys (requested by ops) even if internal PricingKey names differ.
        const envKey = (0, stripePriceIds_1.toStripePriceEnvKey)(key);
        out[envKey] = priceId;
        console.log('OK', { key, priceId, amount: catalog_1.PRICING_CATALOG[key].purchase_price_cents });
    }
    console.log('\nSTRIPE_PRICE_IDS_JSON=' + JSON.stringify(out));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
