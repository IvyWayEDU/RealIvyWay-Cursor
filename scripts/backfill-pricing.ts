import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { getSessionPricingCents, ServiceType, Plan } from '../lib/pricing/catalog';
import { getSessions, saveSessions } from '../lib/sessions/storage';

type AnySession = Record<string, any>;

function normalizeServiceTypeFromSession(s: AnySession): ServiceType | null {
  const raw =
    s.service_type ??
    s.serviceType ??
    s.serviceTypeId ??
    s.sessionType ??
    '';
  const norm = String(raw || '').trim().toLowerCase().replace(/-/g, '_');
  if (norm === 'tutoring') return 'tutoring';
  if (norm === 'test_prep' || norm === 'testprep' || norm === 'test_prep_session') return 'test_prep';
  if (norm === 'virtual_tour' || norm === 'virtual_tours' || norm === 'virtual_tour_single') return 'virtual_tour';
  if (norm === 'counseling' || norm === 'college_counseling') return 'counseling';
  return null;
}

function groupKeyForSession(s: AnySession): string {
  const pi = String(s.stripePaymentIntentId || '').trim();
  const cs = String(s.stripeCheckoutSessionId || '').trim();
  if (pi) return `pi:${pi}`;
  if (cs) return `cs:${cs}`;
  return `session:${String(s.id || '')}`;
}

async function backfill() {
  const sessions = (await getSessions()) as AnySession[];
  assert.ok(Array.isArray(sessions), 'sessions must be an array');

  const groups = new Map<string, AnySession[]>();
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
    const plan: Plan =
      count === 4 ? 'monthly' : 'single';

    // Counseling is 60 minutes only (legacy 30-min records are normalized to 60).
    const duration_minutes: 60 | null = service_type === 'counseling' ? 60 : null;

    let pricing: ReturnType<typeof getSessionPricingCents>;
    try {
      pricing = getSessionPricingCents({ service_type, plan, duration_minutes });
    } catch {
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
      } else if (service_type === 'test_prep') {
        s.serviceType = 'test_prep';
        s.serviceTypeId = 'test_prep';
        s.sessionType = s.sessionType || 'test-prep';
      } else if (service_type === 'virtual_tour') {
        s.serviceType = 'virtual_tour';
        s.serviceTypeId = 'virtual_tour';
        s.sessionType = s.sessionType || 'counseling';
      } else if (service_type === 'tutoring') {
        s.serviceType = 'tutoring';
        s.serviceTypeId = 'tutoring';
        s.sessionType = s.sessionType || 'tutoring';
      }

      patchedCount += 1;
    }

    // Basic audit log for Stripe mismatch (do not mutate Stripe history)
    const expectedTotal = pricing.purchase_price_cents;
    if (k.startsWith('pi:') || k.startsWith('cs:')) {
      const observedTotals = new Set<number>();
      for (const s of group) {
        const n = Number(s.amountChargedCents);
        if (Number.isFinite(n)) observedTotals.add(Math.floor(n));
      }
      // We cannot reliably know Stripe total historically (we only have per-session stored),
      // so we only log the expected purchase total.
      if (observedTotals.size > 1) {
        console.warn('[BACKFILL] inconsistent stored amountChargedCents across group', { key: k, observedTotals: Array.from(observedTotals), expectedPurchaseTotal: expectedTotal });
      }
    }
  }

  await saveSessions(sessions as any);
  console.log('Backfill complete', { patchedCount, skippedCount });

  // Also repair earnings credits/balances if they exist.
  const creditsFile = path.join(process.cwd(), 'data', 'earnings-credits.json');
  const balancesFile = path.join(process.cwd(), 'data', 'provider-earnings.json');
  if (existsSync(creditsFile)) {
    const credits = JSON.parse(readFileSync(creditsFile, 'utf-8')) as Array<any>;
    const sessionById = new Map<string, AnySession>(sessions.map((s) => [String(s.id), s]));
    let creditsPatched = 0;
    for (const c of credits) {
      const sid = String(c.sessionId || '');
      const sess = sessionById.get(sid);
      if (!sess) continue;
      const amt = Number(sess.provider_payout_cents);
      if (!Number.isFinite(amt)) continue;
      c.amountCents = Math.floor(amt);
      creditsPatched += 1;
    }
    writeFileSync(creditsFile, JSON.stringify(credits, null, 2), 'utf-8');
    console.log('Updated earnings credits', { creditsPatched });

    // Recompute balances from credits (idempotent)
    const balances: Record<string, { balanceCents: number; updatedAt: string }> = {};
    for (const c of credits) {
      const pid = String(c.providerId || '');
      const amt = Number(c.amountCents);
      if (!pid || !Number.isFinite(amt)) continue;
      const prev = balances[pid]?.balanceCents ?? 0;
      balances[pid] = { balanceCents: Math.max(0, Math.floor(prev + Math.max(0, Math.floor(amt)))), updatedAt: new Date().toISOString() };
    }
    writeFileSync(balancesFile, JSON.stringify(balances, null, 2), 'utf-8');
    console.log('Rebuilt provider earnings balances', { providerCount: Object.keys(balances).length });
  }
}

backfill().catch((e) => {
  console.error('[backfill-pricing] failed', e);
  process.exit(1);
});


