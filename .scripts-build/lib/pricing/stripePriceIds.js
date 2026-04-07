"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStripePriceEnvKey = toStripePriceEnvKey;
exports.getStripePriceIdForPricingKey = getStripePriceIdForPricingKey;
exports.getStripePriceIdMapDebugInfo = getStripePriceIdMapDebugInfo;
exports.debugLogStripePriceIdMapKeysOnce = debugLogStripePriceIdMapKeysOnce;
exports.debugLogStripePriceIdMapDetailsOnce = debugLogStripePriceIdMapDetailsOnce;
const catalog_1 = require("./catalog");
const path_1 = __importDefault(require("path"));
/**
 * Stripe price id lookup.
 *
 * We intentionally do NOT infer prices from UI or amounts; we always choose
 * the Stripe Price ID by (service_type, plan, duration_minutes) -> PricingKey.
 *
 * Provide as a JSON map in env:
 *   STRIPE_PRICE_IDS_JSON='{"tutoring_single":"price_...","tutoring_monthly":"price_...","counseling_single":"price_...","counseling_monthly":"price_...","testprep_single":"price_...","testprep_monthly":"price_...","virtual_tour_single":"price_...","ai_basic_monthly":"price_...","ai_pro_monthly":"price_...","ai_pro_yearly":"price_..."}'
 */
const STRIPE_ENV_KEY_BY_PRICING_KEY = {
    tutoring_single: 'tutoring_single',
    tutoring_monthly: 'tutoring_monthly',
    counseling_single: 'counseling_single',
    counseling_monthly: 'counseling_monthly',
    test_prep_single: 'testprep_single',
    test_prep_monthly: 'testprep_monthly',
    virtual_tour_single: 'virtual_tour_single',
    ivyway_ai_basic_monthly: 'ai_basic_monthly',
    ivyway_ai_pro_monthly: 'ai_pro_monthly',
    ivyway_ai_pro_yearly: 'ai_pro_yearly',
};
function toStripePriceEnvKey(pricing_key) {
    return STRIPE_ENV_KEY_BY_PRICING_KEY[pricing_key];
}
function getRequiredStripeEnvKeys() {
    const set = new Set();
    for (const item of Object.values(catalog_1.PRICING_CATALOG)) {
        set.add(toStripePriceEnvKey(item.key));
    }
    return Array.from(set).sort();
}
let cachedMap = null;
let cachedSource = null;
let didLogMapKeys = false;
let didLogMapDetails = false;
let lastLoadedFallbackFilePath = null;
let didLogLoadSuccess = false;
let didLogLoadFailure = false;
function previewEnvString(s, head = 24, tail = 24) {
    const raw = String(s);
    if (raw.length <= head + tail + 3)
        return raw;
    return `${raw.slice(0, head)}…${raw.slice(-tail)}`;
}
function tryLoadDevFallbackStripePriceIdMapRaw() {
    // Only allow fallback in non-production environments.
    if (process.env.NODE_ENV === 'production')
        return null;
    try {
        // Use require() so this module remains compatible with environments that
        // might not bundle Node fs in production builds.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        const candidates = [
            // Preferred location
            path_1.default.join(process.cwd(), 'data', 'stripe-price-ids.local.json'),
            // Alternate/legacy locations (safe to keep)
            path_1.default.join(process.cwd(), 'stripe-price-ids.local.json'),
        ];
        for (const abs of candidates) {
            if (fs.existsSync(abs)) {
                const raw = fs.readFileSync(abs, 'utf8');
                if (typeof raw === 'string' && raw.trim()) {
                    lastLoadedFallbackFilePath = abs;
                    return { raw, filePath: abs };
                }
            }
        }
    }
    catch {
        // Ignore; we'll fall back to throwing the normal "Missing env var" error below.
    }
    return null;
}
function loadStripePriceIdMapFromEnv() {
    if (cachedMap)
        return cachedMap;
    const envRaw = process.env.STRIPE_PRICE_IDS_JSON;
    const fallback = envRaw ? null : tryLoadDevFallbackStripePriceIdMapRaw();
    const raw = envRaw || fallback?.raw;
    const requiredKeys = getRequiredStripeEnvKeys();
    // Log EXACT source decision up front (requested).
    cachedSource = envRaw ? 'env' : 'dev_fallback';
    if (!envRaw && fallback?.filePath)
        lastLoadedFallbackFilePath = fallback.filePath;
    try {
        if (!raw) {
            throw new Error('Missing STRIPE_PRICE_IDS_JSON env var (JSON map from pricing key → Stripe price id). For local dev you can alternatively create data/stripe-price-ids.local.json.');
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            const first = String(raw).slice(0, 1);
            const last = String(raw).slice(-1);
            // Common prod misconfig: pasting STRIPE_PRICE_IDS_JSON with wrapping single-quotes into Vercel env vars.
            throw new Error(`Invalid STRIPE_PRICE_IDS_JSON (must be valid JSON). length=${String(raw).length} firstChar=${JSON.stringify(first)} lastChar=${JSON.stringify(last)} preview=${JSON.stringify(previewEnvString(String(raw)))}`);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Invalid STRIPE_PRICE_IDS_JSON (must be a JSON object)');
        }
        const obj = parsed;
        const missing = [];
        const out = {};
        for (const k of requiredKeys) {
            const v = obj[k];
            if (typeof v !== 'string' || !v.trim()) {
                missing.push(k);
                continue;
            }
            const trimmed = v.trim();
            // Stripe Price IDs look like `price_...` (not `prod_...`).
            if (!trimmed.startsWith('price_')) {
                throw new Error(`Invalid STRIPE_PRICE_IDS_JSON value for key=${k}. Expected a Stripe Price ID starting with "price_", got: ${trimmed}`);
            }
            out[k] = trimmed;
        }
        if (missing.length > 0) {
            throw new Error(`STRIPE_PRICE_IDS_JSON is missing required keys: ${missing.join(', ')}`);
        }
        cachedMap = out;
        // Log what got loaded (requested); do not spam.
        if (!didLogLoadSuccess) {
            didLogLoadSuccess = true;
            console.log('[STRIPE_PRICE_IDS_JSON LOADED]', {
                source: cachedSource,
                keys: Object.keys(cachedMap).sort(),
                tutoring_single: cachedMap.tutoring_single,
                fallbackFilePath: lastLoadedFallbackFilePath,
                hasEnvVar: typeof envRaw === 'string' && !!envRaw.trim(),
            });
        }
        return cachedMap;
    }
    catch (e) {
        // Log exact parse/validation error (requested); do not spam.
        if (!didLogLoadFailure) {
            didLogLoadFailure = true;
            const envPresent = typeof envRaw === 'string' && !!envRaw.trim();
            console.error('[STRIPE_PRICE_IDS_JSON LOAD FAILED]', {
                source: cachedSource,
                message: e instanceof Error ? e.message : String(e),
                nodeEnv: process.env.NODE_ENV,
                hasEnvVar: envPresent,
                envVarLength: envPresent ? envRaw.length : null,
                envVarPreview: envPresent ? previewEnvString(envRaw) : null,
                fallbackFilePath: lastLoadedFallbackFilePath,
                cwd: process.cwd(),
            });
        }
        throw e;
    }
}
function getStripePriceIdForPricingKey(pricing_key) {
    const envKey = toStripePriceEnvKey(pricing_key);
    const map = loadStripePriceIdMapFromEnv();
    const id = map[envKey];
    if (typeof id !== 'string' || !id.trim()) {
        // Should not happen because loadStripePriceIdMapFromEnv validates required keys
        throw new Error(`Missing Stripe price id for pricing_key=${pricing_key} (envKey=${envKey})`);
    }
    return id.trim();
}
function getStripePriceIdMapDebugInfo() {
    const map = loadStripePriceIdMapFromEnv();
    // loadStripePriceIdMapFromEnv always sets cachedSource if it succeeds
    const source = cachedSource || 'env';
    const envRaw = process.env.STRIPE_PRICE_IDS_JSON;
    return {
        source,
        keys: Object.keys(map).sort(),
        cwd: process.cwd(),
        hasEnvVar: typeof envRaw === 'string' && !!envRaw.trim(),
        envVarLength: typeof envRaw === 'string' ? envRaw.length : null,
        envVarPreview: typeof envRaw === 'string' ? previewEnvString(envRaw) : null,
        fallbackFilePath: lastLoadedFallbackFilePath,
        tutoringSingle: map.tutoring_single ?? null,
    };
}
function debugLogStripePriceIdMapKeysOnce(logPrefix = 'STRIPE_PRICE_IDS') {
    if (didLogMapKeys)
        return;
    didLogMapKeys = true;
    try {
        const info = getStripePriceIdMapDebugInfo();
        console.log(`${logPrefix} map source:`, info.source);
        console.log(`${logPrefix} map keys:`, info.keys);
    }
    catch (e) {
        console.warn(`${logPrefix} map load failed:`, e);
    }
}
function debugLogStripePriceIdMapDetailsOnce(logPrefix = 'STRIPE_PRICE_IDS') {
    if (didLogMapDetails)
        return;
    didLogMapDetails = true;
    try {
        const info = getStripePriceIdMapDebugInfo();
        console.log(`${logPrefix} cwd:`, info.cwd);
        console.log(`${logPrefix} env present:`, info.hasEnvVar);
        console.log(`${logPrefix} env length:`, info.envVarLength);
        console.log(`${logPrefix} env preview:`, info.envVarPreview);
        console.log(`${logPrefix} fallback file path:`, info.fallbackFilePath);
        console.log(`${logPrefix} tutoring_single:`, info.tutoringSingle);
    }
    catch (e) {
        console.warn(`${logPrefix} map debug failed:`, e);
    }
}
