import { Session } from '@/lib/models/types';
import { getProviderPayoutCents, getSessionPricingCents, ServiceType, Plan } from '@/lib/pricing/catalog';

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getSessionGrossCents(session: Session): number {
  const canonical = toFiniteNumber((session as any)?.session_price_cents);
  const legacyPrice = toFiniteNumber((session as any)?.priceCents);
  const charged = toFiniteNumber((session as any)?.amountChargedCents);
  const gross = canonical ?? legacyPrice ?? charged ?? 0;
  return Math.max(0, Math.floor(gross));
}

function isProviderNoShow(session: Session): boolean {
  const s: any = session as any;
  const status = String(s?.status || '').trim().toLowerCase();
  const noShowParty = String(s?.noShowParty || '').trim().toLowerCase();
  const attendanceFlag = String(s?.attendanceFlag || '').trim().toLowerCase();
  const flag = String(s?.flag || '').trim().toLowerCase();
  const explicitFlag = s?.flagNoShowProvider === true;
  return (
    status === 'provider_no_show' ||
    status === 'no_show_provider' ||
    status === 'expired_provider_no_show' ||
    status === 'no_show_both' ||
    flag === 'provider_no_show' ||
    attendanceFlag === 'provider_no_show' ||
    attendanceFlag === 'full_no_show' ||
    noShowParty === 'provider' ||
    noShowParty === 'both' ||
    explicitFlag
  );
}

function isCancelledOrRefunded(session: Session): boolean {
  const s: any = session as any;
  const status = String(s?.status || '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'canceled' || status === 'cancelled-late' || status === 'refunded') return true;
  const refunded = toFiniteNumber(s?.amountRefundedCents) ?? 0;
  return refunded > 0;
}

function providerShouldBePaid(session: Session): boolean {
  const s: any = session as any;

  // Hard blocks: provider no-show, cancellations, and refunds.
  if (isProviderNoShow(session)) return false;
  if (isCancelledOrRefunded(session)) return false;

  // Explicit overrides win.
  if (typeof s?.providerEarned === 'boolean') return s.providerEarned === true;
  if (typeof s?.providerEligibleForPayout === 'boolean') return s.providerEligibleForPayout === true;

  // Best-effort fallback for legacy records: pay only if provider joined at some point.
  const providerJoinedAtRaw = s?.providerJoinedAt;
  const joinedMs =
    typeof providerJoinedAtRaw === 'string' && providerJoinedAtRaw.trim()
      ? new Date(providerJoinedAtRaw).getTime()
      : NaN;
  return Number.isFinite(joinedMs);
}

/**
 * Canonical provider payout calculation (integer cents).
 *
 * Requirements:
 * - Provider payout must be the FIXED flat payout from `getProviderPayout(serviceType)`.
 * - NEVER derive provider payout from Stripe charge minus fees.
 * - NEVER apply Stripe fees to provider earnings.
 */
export function calculateProviderPayoutCentsFromSession(
  session: Session
): number {
  // Canonical payout eligibility: derived from the session lifecycle resolver.
  // Student attendance must NEVER block provider payout.
  // Provider no-show / cancelled / refunded sessions MUST pay $0.
  if (!providerShouldBePaid(session)) return 0;

  // 1) If already persisted on the session record, trust it (immutable once booked).
  const persistedDollars = toFiniteNumber((session as any)?.providerPayout);
  if (persistedDollars != null) {
    return Math.max(0, Math.floor(Math.round(persistedDollars * 100)));
  }
  const persisted = toFiniteNumber((session as any)?.provider_payout_cents ?? (session as any)?.providerPayoutCents);
  if (persisted != null) return Math.max(0, Math.floor(persisted));

  // 2) Fall back to pricing catalog lookup (legacy sessions may be missing canonical fields).
  const service_type_raw =
    (session as any)?.service_type ??
    (session as any)?.serviceType ??
    (session as any)?.serviceTypeId ??
    (session as any)?.sessionType ??
    '';
  const service_type_norm = String(service_type_raw || '').trim().toLowerCase().replace(/-/g, '_');
  const service_type: ServiceType | null =
    service_type_norm === 'tutoring'
      ? 'tutoring'
      : service_type_norm === 'counseling' || service_type_norm === 'college_counseling'
        ? 'counseling'
        : service_type_norm === 'test_prep' || service_type_norm === 'testprep'
          ? 'test_prep'
          : service_type_norm === 'virtual_tour' || service_type_norm === 'virtual_tours' || service_type_norm === 'virtual_tour_single' || service_type_norm === 'virtual-tour'
            ? 'virtual_tour'
            : null;

  if (!service_type) return 0;

  const plan_raw = (session as any)?.plan;
  const plan_norm = typeof plan_raw === 'string' ? plan_raw.trim().toLowerCase() : '';
  const plan: Plan =
    plan_norm === 'monthly'
      ? 'monthly'
      : plan_norm === 'yearly'
        ? 'yearly'
        : 'single';

  const duration_minutes: 60 | null = service_type === 'counseling' ? 60 : null;

  try {
    return getProviderPayoutCents(service_type, duration_minutes, plan);
  } catch {
    // As a last resort, if we cannot map the session cleanly, do not pay.
    return 0;
  }
}


