/**
 * Validation helper for Stripe Tax rollout.
 *
 * Usage (after booking counseling in dev):
 *   npm run tax:validate-booking
 *
 * This checks:
 * - session_price_cents stays the base catalog per-session price
 * - provider_payout_cents stays fixed (50.00) for counseling sessions
 * - tax_amount_cents is present and total_charge_cents = base + tax
 */

import { getProviderPayout } from '../lib/payouts/getProviderPayout';
import { getSupabaseAdmin } from '../lib/supabase/admin.server';

type AnySession = Record<string, any>;

function toFiniteInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

async function main() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('sessions').select('data');
  if (error) throw error;
  const all = (data ?? []).map((r: any) => r?.data).filter(Boolean) as AnySession[];

  const counselingPaid = (all as AnySession[])
    .filter((s) => {
      const st = String(s?.service_type ?? s?.serviceType ?? '').toLowerCase().replace(/-/g, '_');
      const dur = toFiniteInt(s?.duration_minutes);
      const isPaid = s?.isPaid === true || String(s?.paymentStatus ?? '').toLowerCase() === 'paid';
      return st === 'counseling' && dur === 60 && isPaid;
    })
    .sort((a, b) => {
      const ta = Date.parse(String(a?.bookedAt ?? a?.createdAt ?? '')) || 0;
      const tb = Date.parse(String(b?.bookedAt ?? b?.createdAt ?? '')) || 0;
      return tb - ta;
    });

  const latest = counselingPaid[0];
  if (!latest) {
    console.error('No paid counseling (60 min) sessions found in Supabase sessions');
    process.exit(1);
  }

  const base = toFiniteInt(latest?.session_price_cents ?? latest?.priceCents);
  const payout = toFiniteInt(latest?.provider_payout_cents ?? latest?.providerPayoutCents);
  const tax = toFiniteInt(latest?.tax_amount_cents);
  const total = toFiniteInt(latest?.total_charge_cents ?? latest?.amountChargedCents);

  const planNorm = String(latest?.plan ?? '').trim().toLowerCase();
  const plan = planNorm === 'monthly' ? 'monthly' : 'single';

  // Source of truth:
  // - Counseling single: 8900 base, 5000 payout
  // - Counseling monthly: 29900 / 4 = 7475 base per session, 5000 payout per session
  const expectedBase = plan === 'monthly' ? 7475 : 8900;
  const expectedPayout = Math.floor(getProviderPayout('college_counseling') * 100);

  const problems: string[] = [];
  if (base !== expectedBase) problems.push(`Expected session_price_cents=${expectedBase}, got ${base}`);
  if (payout !== expectedPayout) problems.push(`Expected provider_payout_cents=${expectedPayout}, got ${payout}`);
  if (tax == null) problems.push('Missing tax_amount_cents (did Stripe Tax run?)');
  if (tax != null && tax < 0) problems.push(`Invalid tax_amount_cents=${tax}`);
  if (total == null) problems.push('Missing total_charge_cents / amountChargedCents');
  if (tax != null && total != null && base != null && total !== base + tax) {
    problems.push(`Expected total_charge_cents=base+tax (${base}+${tax}=${base + tax}), got ${total}`);
  }

  console.log('Latest counseling paid session:', {
    id: latest?.id,
    plan,
    stripeCheckoutSessionId: latest?.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: latest?.stripePaymentIntentId ?? null,
    session_price_cents: base,
    tax_amount_cents: tax,
    total_charge_cents: total,
    provider_payout_cents: payout,
  });

  if (problems.length) {
    console.error('\nVALIDATION FAILED:');
    for (const p of problems) console.error('-', p);
    process.exit(1);
  }

  console.log('\nVALIDATION OK');
}

main().catch((e) => {
  console.error('[validate-tax-booking] failed', e);
  process.exit(1);
});


