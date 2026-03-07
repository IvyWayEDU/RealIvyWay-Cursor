"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const strict_1 = __importDefault(require("node:assert/strict"));
const catalog_1 = require("../lib/pricing/catalog");
function normalizeServiceTypeFromSession(s) {
    const raw = s.service_type ??
        s.serviceType ??
        s.serviceTypeId ??
        s.sessionType ??
        '';
    const norm = String(raw || '').trim().toLowerCase().replace(/-/g, '_');
    if (norm === 'tutoring')
        return 'tutoring';
    if (norm === 'test_prep' || norm === 'testprep' || norm === 'test_prep_session')
        return 'test_prep';
    if (norm === 'virtual_tour' || norm === 'virtual_tours' || norm === 'virtual_tour_single')
        return 'virtual_tour';
    if (norm === 'counseling' || norm === 'college_counseling')
        return 'counseling';
    return null;
}
function groupKeyForSession(s) {
    const pi = String(s.stripePaymentIntentId || '').trim();
    const cs = String(s.stripeCheckoutSessionId || '').trim();
    if (pi)
        return `pi:${pi}`;
    if (cs)
        return `cs:${cs}`;
    return `session:${String(s.id || '')}`;
}
function backfill() {
    const sessionsFile = node_path_1.default.join(process.cwd(), 'data', 'sessions.json');
    if (!(0, node_fs_1.existsSync)(sessionsFile)) {
        throw new Error(`sessions.json not found at ${sessionsFile}`);
    }
    const raw = (0, node_fs_1.readFileSync)(sessionsFile, 'utf-8');
    const sessions = JSON.parse(raw);
    strict_1.default.ok(Array.isArray(sessions), 'sessions.json must be an array');
    const groups = new Map();
    for (const s of sessions) {
        const k = groupKeyForSession(s);
        const arr = groups.get(k) || [];
        arr.push(s);
        groups.set(k, arr);
    }
    let patchedCount = 0;
    let skippedCount = 0;
    for (const [k, group] of groups.entries()) {
        const service_type = normalizeServiceTypeFromSession(group[0]);
        if (!service_type) {
            skippedCount += group.length;
            continue;
        }
        const count = group.length;
        const plan = count === 4 ? 'monthly' : 'single';
        // Counseling is 60 minutes only (legacy 30-min records are normalized to 60).
        const duration_minutes = service_type === 'counseling' ? 60 : null;
        let pricing;
        try {
            pricing = (0, catalog_1.getSessionPricingCents)({ service_type, plan, duration_minutes });
        }
        catch {
            skippedCount += group.length;
            continue;
        }
        // Update every session in the group with per-session canonical cents.
        for (const s of group) {
            // Keep legacy fields consistent too
            s.service_type = service_type;
            s.plan = plan;
            s.duration_minutes = duration_minutes;
            s.session_price_cents = pricing.session_price_cents;
            s.provider_payout_cents = pricing.provider_payout_cents;
            // New canonical provider payout snapshot (USD dollars)
            s.providerPayout = Math.floor(pricing.provider_payout_cents) / 100;
            s.providerPayoutCents = pricing.provider_payout_cents;
            s.providerPayoutAmount = Math.floor(pricing.provider_payout_cents) / 100;
            s.ivyway_take_cents = pricing.ivyway_take_cents;
            s.stripe_fee_cents = Number.isFinite(Number(s.stripe_fee_cents)) ? Math.floor(Number(s.stripe_fee_cents)) : 0;
            // Backwards-compatible money fields used throughout the app
            s.priceCents = pricing.session_price_cents;
            s.amountChargedCents = pricing.session_price_cents;
            // Normalize legacy counseling serviceType for older UI code paths
            if (service_type === 'counseling') {
                s.serviceType = 'college_counseling';
                s.serviceTypeId = 'college_counseling';
                s.sessionType = s.sessionType || 'counseling';
            }
            else if (service_type === 'test_prep') {
                s.serviceType = 'test_prep';
                s.serviceTypeId = 'test_prep';
                s.sessionType = s.sessionType || 'test-prep';
            }
            else if (service_type === 'virtual_tour') {
                s.serviceType = 'virtual_tour';
                s.serviceTypeId = 'virtual_tour';
                s.sessionType = s.sessionType || 'counseling';
            }
            else if (service_type === 'tutoring') {
                s.serviceType = 'tutoring';
                s.serviceTypeId = 'tutoring';
                s.sessionType = s.sessionType || 'tutoring';
            }
            patchedCount += 1;
        }
        // Basic audit log for Stripe mismatch (do not mutate Stripe history)
        const expectedTotal = pricing.purchase_price_cents;
        if (k.startsWith('pi:') || k.startsWith('cs:')) {
            const observedTotals = new Set();
            for (const s of group) {
                const n = Number(s.amountChargedCents);
                if (Number.isFinite(n))
                    observedTotals.add(Math.floor(n));
            }
            // We cannot reliably know Stripe total historically (we only have per-session stored),
            // so we only log the expected purchase total.
            if (observedTotals.size > 1) {
                console.warn('[BACKFILL] inconsistent stored amountChargedCents across group', { key: k, observedTotals: Array.from(observedTotals), expectedPurchaseTotal: expectedTotal });
            }
        }
    }
    const backupPath = sessionsFile.replace(/sessions\.json$/, `sessions.backup.${Date.now()}.json`);
    (0, node_fs_1.writeFileSync)(backupPath, raw, 'utf-8');
    (0, node_fs_1.writeFileSync)(sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8');
    console.log('Backfill complete', { patchedCount, skippedCount, backupPath });
    // Also repair earnings credits/balances if they exist.
    const creditsFile = node_path_1.default.join(process.cwd(), 'data', 'earnings-credits.json');
    const balancesFile = node_path_1.default.join(process.cwd(), 'data', 'provider-earnings.json');
    if ((0, node_fs_1.existsSync)(creditsFile)) {
        const credits = JSON.parse((0, node_fs_1.readFileSync)(creditsFile, 'utf-8'));
        const sessionById = new Map(sessions.map((s) => [String(s.id), s]));
        let creditsPatched = 0;
        for (const c of credits) {
            const sid = String(c.sessionId || '');
            const sess = sessionById.get(sid);
            if (!sess)
                continue;
            const amt = Number(sess.provider_payout_cents);
            if (!Number.isFinite(amt))
                continue;
            c.amountCents = Math.floor(amt);
            creditsPatched += 1;
        }
        (0, node_fs_1.writeFileSync)(creditsFile, JSON.stringify(credits, null, 2), 'utf-8');
        console.log('Updated earnings credits', { creditsPatched });
        // Recompute balances from credits (idempotent)
        const balances = {};
        for (const c of credits) {
            const pid = String(c.providerId || '');
            const amt = Number(c.amountCents);
            if (!pid || !Number.isFinite(amt))
                continue;
            const prev = balances[pid]?.balanceCents ?? 0;
            balances[pid] = { balanceCents: Math.max(0, Math.floor(prev + Math.max(0, Math.floor(amt)))), updatedAt: new Date().toISOString() };
        }
        (0, node_fs_1.writeFileSync)(balancesFile, JSON.stringify(balances, null, 2), 'utf-8');
        console.log('Rebuilt provider earnings balances', { providerCount: Object.keys(balances).length });
    }
}
backfill();
