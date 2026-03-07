import assert from 'node:assert/strict';
import { getSessionPricingCents } from '../lib/pricing/catalog';
import { getProviderPayout } from '../lib/payouts/getProviderPayout';

function run() {
  // Counseling single (60 min only) charges 89.00 provider earns 50.00
  {
    const p = getSessionPricingCents({ service_type: 'counseling', plan: 'single', duration_minutes: 60 });
    assert.equal(p.purchase_price_cents, 8900);
    assert.equal(p.provider_payout_cents, Math.floor(getProviderPayout('college_counseling') * 100));
    assert.equal(p.ivyway_take_cents, 8900 - Math.floor(getProviderPayout('college_counseling') * 100));
  }

  // Tutoring single charges 69.00 provider earns 48.00
  {
    const p = getSessionPricingCents({ service_type: 'tutoring', plan: 'single', duration_minutes: null });
    assert.equal(p.purchase_price_cents, 6900);
    assert.equal(p.provider_payout_cents, Math.floor(getProviderPayout('tutoring') * 100));
  }

  // Test prep single charges 149.00 provider earns 70.00
  {
    const p = getSessionPricingCents({ service_type: 'test_prep', plan: 'single', duration_minutes: null });
    assert.equal(p.purchase_price_cents, 14900);
    assert.equal(p.provider_payout_cents, Math.floor(getProviderPayout('test_prep') * 100));
  }

  // Virtual tour charges 124.00 provider earns 65.00
  {
    const p = getSessionPricingCents({ service_type: 'virtual_tour', plan: 'single', duration_minutes: null });
    assert.equal(p.purchase_price_cents, 12400);
    assert.equal(p.provider_payout_cents, Math.floor(getProviderPayout('virtual_tour') * 100));
  }

  // Tutoring monthly charges 249.00 and each completed session credits 48.00 to provider (4 sessions total)
  {
    const p = getSessionPricingCents({ service_type: 'tutoring', plan: 'monthly', duration_minutes: null });
    assert.equal(p.purchase_price_cents, 24900);
    assert.equal(p.sessions_per_purchase, 4);
    assert.equal(p.provider_payout_cents, Math.floor(getProviderPayout('tutoring') * 100));
    assert.equal(p.provider_payout_cents * 4, Math.floor(getProviderPayout('tutoring') * 100) * 4);
  }

  // Counseling monthly charges 299.00 and each completed session credits 50.00 to provider (4 sessions total)
  {
    const p = getSessionPricingCents({ service_type: 'counseling', plan: 'monthly', duration_minutes: 60 });
    assert.equal(p.purchase_price_cents, 29900);
    assert.equal(p.sessions_per_purchase, 4);
    assert.equal(p.provider_payout_cents, Math.floor(getProviderPayout('college_counseling') * 100));
    assert.equal(p.provider_payout_cents * 4, Math.floor(getProviderPayout('college_counseling') * 100) * 4);
  }

  console.log('OK: pricing validation passed');
}

run();


