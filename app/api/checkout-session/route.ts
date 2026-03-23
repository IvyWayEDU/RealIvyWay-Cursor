import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth/middleware';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { createSession, getSessions } from '@/lib/sessions/storage';
import { readCheckoutBookingRecord, deleteCheckoutBookingRecord } from '@/lib/stripe/checkoutBookingStore.server';
import crypto from 'crypto';
import { getSessionPricingCents, ServiceType as PricingServiceType, Plan as PricingPlan } from '@/lib/pricing/catalog';
import { getProviderPayout } from '@/lib/payouts/getProviderPayout';
import { getUserById } from '@/lib/auth/storage';
import { handleApiError } from '@/lib/errorHandler';

// Initialize Stripe with secret key from environment variable
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function toIsoOrNull(v: unknown): string | null {
  if (!isNonEmptyString(v)) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function normalizeServiceType(raw: unknown): 'tutoring' | 'test_prep' | 'virtual_tour' | 'college_counseling' | null {
  const v = isNonEmptyString(raw) ? raw.trim().toLowerCase().replace(/-/g, '_') : '';
  if (!v) return null;
  if (v === 'tutoring') return 'tutoring';
  if (v === 'test_prep' || v === 'testprep') return 'test_prep';
  if (v === 'virtual_tour' || v === 'virtual_tours') return 'virtual_tour';
  if (v === 'college_counseling' || v === 'counseling') return 'college_counseling';
  return null;
}

function parseClientReferenceId(raw: unknown): {
  serviceType?: string;
  studentId?: string;
  providerId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  checkoutBookingId?: string;
} | null {
  if (!isNonEmptyString(raw)) return null;
  const parts = raw.split('|').map((s) => s.trim());
  // Format used by /api/checkout:
  // ivyway|{serviceType}|{studentId}|{providerId}|{startIso}|{endIso}|{checkoutBookingId}
  if (parts.length < 7) return null;
  if (parts[0] !== 'ivyway') return null;
  return {
    serviceType: parts[1] || undefined,
    studentId: parts[2] || undefined,
    providerId: parts[3] || undefined,
    scheduledStart: parts[4] || undefined,
    scheduledEnd: parts[5] || undefined,
    checkoutBookingId: parts[6] || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await auth.require();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/checkout-session',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    // Get session_id from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify payment completion
    const isPaid =
      checkoutSession.payment_status === 'paid' ||
      (typeof checkoutSession.status === 'string' && checkoutSession.status === 'complete');
    if (!isPaid) {
      return NextResponse.json(
        { error: 'Checkout session is not paid/complete' },
        { status: 409 }
      );
    }

    // SECURITY: Verify that the session belongs to the current user.
    // We accept either metadata.userId or metadata.studentId (and also fall back to the server-side checkout store
    // or the client_reference_id format produced by /api/checkout).
    const md = checkoutSession.metadata || {};
    const mdUserId = isNonEmptyString((md as any).userId) ? String((md as any).userId).trim() : '';
    const mdStudentId = isNonEmptyString((md as any).studentId) ? String((md as any).studentId).trim() : '';
    const mdCheckoutBookingId = isNonEmptyString((md as any).checkoutBookingId) ? String((md as any).checkoutBookingId).trim() : '';
    const ref = parseClientReferenceId((checkoutSession as any).client_reference_id);

    const checkoutBookingId = mdCheckoutBookingId || ref?.checkoutBookingId || '';
    const checkoutBooking = checkoutBookingId ? await readCheckoutBookingRecord(checkoutBookingId) : null;

    const expectedStudentId =
      mdUserId ||
      mdStudentId ||
      (checkoutBooking && isNonEmptyString(checkoutBooking.studentId) ? checkoutBooking.studentId : '') ||
      (ref?.studentId || '');

    if (!expectedStudentId) {
      return NextResponse.json(
        { error: 'Forbidden: Unable to verify checkout session ownership' },
        { status: 403 }
      );
    }

    if (expectedStudentId !== session.userId) {
      return NextResponse.json(
        { error: 'Forbidden: Checkout session does not belong to this user' },
        { status: 403 }
      );
    }

    // Idempotency: if sessions already exist for this Stripe checkout session, return them.
    const allSessions = await getSessions();
    const existingForStripe = allSessions.filter((s: any) => String((s as any)?.stripeCheckoutSessionId || '').trim() === checkoutSession.id);

    // Derive session creation inputs (bundle-preferred checkout store; legacy sessionsJson fallback)
    const serviceTypeRaw =
      (checkoutBooking && isNonEmptyString(checkoutBooking.serviceType) ? checkoutBooking.serviceType : '') ||
      (isNonEmptyString((md as any).serviceType) ? String((md as any).serviceType).trim() : '') ||
      (isNonEmptyString((md as any).service_type) ? String((md as any).service_type).trim() : '') ||
      (ref?.serviceType || '');
    const serviceType = normalizeServiceType(serviceTypeRaw);

    const providerId =
      (checkoutBooking && isNonEmptyString(checkoutBooking.providerId) ? checkoutBooking.providerId : '') ||
      (isNonEmptyString((md as any).providerId) ? String((md as any).providerId).trim() : '') ||
      (ref?.providerId || '');

    type SessionTime = { startIso: string; endIso: string };
    const timesFromCheckoutStore: SessionTime[] =
      checkoutBooking && Array.isArray(checkoutBooking.sessionTimes)
        ? checkoutBooking.sessionTimes
            .map((t: any) => {
              const s = toIsoOrNull(t?.scheduledStart);
              const e = toIsoOrNull(t?.scheduledEnd);
              if (!s || !e) return null;
              if (new Date(e).getTime() <= new Date(s).getTime()) return null;
              return { startIso: s, endIso: e };
            })
            .filter(Boolean) as any
        : [];

    const timesFromMetadata: SessionTime[] = (() => {
      const raw = (md as any).sessionsJson;
      if (!isNonEmptyString(raw)) return [];
      try {
        const parsed = JSON.parse(String(raw));
        if (!Array.isArray(parsed)) return [];
        const out: SessionTime[] = [];
        for (const item of parsed) {
          const s = toIsoOrNull((item as any)?.scheduledStart);
          const e = toIsoOrNull((item as any)?.scheduledEnd);
          if (!s || !e) return [];
          if (new Date(e).getTime() <= new Date(s).getTime()) return [];
          out.push({ startIso: s, endIso: e });
        }
        return out;
      } catch {
        return [];
      }
    })();
    const timesFromPackedMetadata: SessionTime[] = (() => {
      const packed = isNonEmptyString((md as any).sessionsPacked) ? String((md as any).sessionsPacked) : '';
      if (!packed) return [];
      const pieces = packed
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean);
      if (pieces.length === 0) return [];
      const out: SessionTime[] = [];
      for (const piece of pieces) {
        const [rawStart, rawEnd] = piece.split(',').map((p) => p.trim());
        const s = toIsoOrNull(rawStart);
        const e = toIsoOrNull(rawEnd);
        if (!s || !e) return [];
        if (new Date(e).getTime() <= new Date(s).getTime()) return [];
        out.push({ startIso: s, endIso: e });
      }
      return out;
    })();

    const singleStartIso =
      toIsoOrNull((md as any).scheduledStart || (md as any).startTime || ref?.scheduledStart);
    const singleEndIso =
      toIsoOrNull((md as any).scheduledEnd || (md as any).endTime || ref?.scheduledEnd);

    const sessionTimes: SessionTime[] =
      timesFromCheckoutStore.length > 0
        ? timesFromCheckoutStore
        : timesFromMetadata.length > 0
          ? timesFromMetadata
          : timesFromPackedMetadata.length > 0
            ? timesFromPackedMetadata
          : (singleStartIso && singleEndIso ? [{ startIso: singleStartIso, endIso: singleEndIso }] : []);

    // If we already have any sessions for this stripeSessionId, we still allow "fill in the missing ones"
    // (retry safety) but never create duplicates.
    const existingByTime = new Set<string>(
      existingForStripe.map((s: any) => {
        const sStart = s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
        const sEnd = s?.endTime || s?.scheduledEndTime || s?.scheduledEnd;
        return `${String(sStart || '')}|${String(sEnd || '')}`;
      })
    );

    const created: any[] = [];
    const stripePaymentIntentId = typeof (checkoutSession as any)?.payment_intent === 'string' ? String((checkoutSession as any).payment_intent).trim() : '';

    if (existingForStripe.length === 0 || sessionTimes.some((t) => !existingByTime.has(`${t.startIso}|${t.endIso}`))) {
      if (!serviceType || !providerId || sessionTimes.length === 0) {
        return NextResponse.json(
          { error: 'Unable to finalize booking: missing booking metadata (serviceType/providerId/sessionTimes)' },
          { status: 500 }
        );
      }

      const nowIso = new Date().toISOString();

      // Snapshot participant info for UI (sessions do not hydrate names at read-time).
      const extractProfileImageUrl = (user: any): string => {
        const v =
          user?.profileImageUrl ??
          user?.profileImage ??
          user?.profilePhotoUrl ??
          user?.avatarUrl ??
          user?.photoUrl ??
          '';
        return typeof v === 'string' ? v.trim() : '';
      };
      const studentUser = await getUserById(expectedStudentId);
      const providerUser = await getUserById(providerId);
      const studentName = typeof (studentUser as any)?.name === 'string' ? String((studentUser as any).name).trim() : '';
      const providerName = typeof (providerUser as any)?.name === 'string' ? String((providerUser as any).name).trim() : '';
      const studentProfileImage = extractProfileImageUrl(studentUser) || null;
      const providerProfileImage = extractProfileImageUrl(providerUser) || null;

      const providerSchoolId =
        (providerUser && typeof (providerUser as any)?.school_id === 'string' && String((providerUser as any).school_id).trim()
          ? String((providerUser as any).school_id).trim()
          : null) ??
        (providerUser && Array.isArray((providerUser as any)?.schoolIds) && (providerUser as any).schoolIds.length > 0
          ? String((providerUser as any).schoolIds[0] || '').trim()
          : null);
      const providerSchoolName =
        (providerUser && typeof (providerUser as any)?.school_name === 'string' && String((providerUser as any).school_name).trim()
          ? String((providerUser as any).school_name).trim()
          : null) ??
        (providerUser && Array.isArray((providerUser as any)?.schoolNames) && (providerUser as any).schoolNames.length > 0
          ? String((providerUser as any).schoolNames[0] || '').trim()
          : null) ??
        (providerUser && typeof (providerUser as any)?.school === 'string' && String((providerUser as any).school).trim()
          ? String((providerUser as any).school).trim()
          : null) ??
        '';

      // Pricing + tax allocation: keep consistent with webhook so earnings/payouts are correct.
      const planRaw =
        checkoutBooking?.plan
          ? String(checkoutBooking.plan).trim().toLowerCase()
          : (isNonEmptyString((md as any).plan) ? String((md as any).plan).trim().toLowerCase() : 'single');
      const plan: PricingPlan =
        planRaw === 'monthly' ? 'monthly' : planRaw === 'yearly' ? 'yearly' : 'single';

      const pricingServiceType: PricingServiceType =
        serviceType === 'college_counseling' ? 'counseling' : (serviceType as any);
      const duration_minutes: 60 | null = pricingServiceType === 'counseling' ? 60 : null;

      const pricing = getSessionPricingCents({
        service_type: pricingServiceType,
        plan,
        duration_minutes,
      });

      // Stripe Tax: allocate per session for bundles
      const stripeTaxCents =
        typeof (checkoutSession as any)?.total_details?.amount_tax === 'number'
          ? Math.max(0, Math.floor((checkoutSession as any).total_details.amount_tax))
          : 0;
      const sessionsPerPurchase = Math.max(1, Math.floor(pricing.sessions_per_purchase || 1));
      const taxBasePerSession = Math.floor(stripeTaxCents / sessionsPerPurchase);
      const taxRemainder = stripeTaxCents - taxBasePerSession * sessionsPerPurchase;

      const payoutServiceType = pricingServiceType === 'counseling' ? 'college_counseling' : pricingServiceType;
      const providerPayout = getProviderPayout(payoutServiceType);
      const providerPayoutCents = Math.max(0, Math.floor(providerPayout * 100));

      const subject = isNonEmptyString((md as any).subject) ? String((md as any).subject).trim() : '';
      const topic =
        (checkoutBooking && isNonEmptyString((checkoutBooking as any)?.topic) ? String((checkoutBooking as any).topic).trim() : '') ||
        (isNonEmptyString((md as any).topic) ? String((md as any).topic).trim() : '');

      for (let i = 0; i < sessionTimes.length; i++) {
        const { startIso, endIso } = sessionTimes[i];
        const key = `${startIso}|${endIso}`;
        if (existingByTime.has(key)) continue;

        try {
          const taxForThisSession = taxBasePerSession + (i < taxRemainder ? 1 : 0);
          const totalChargeForThisSession = pricing.session_price_cents + taxForThisSession;
          const startMs = new Date(startIso).getTime();
          const endMs = new Date(endIso).getTime();
          const durationMinutes = Math.round((endMs - startMs) / (1000 * 60));

          const sessionTypeLabel =
            serviceType === 'tutoring'
              ? 'tutoring'
              : serviceType === 'test_prep'
                ? 'test-prep'
                : serviceType === 'virtual_tour'
                  ? 'virtual-tour'
                  : 'counseling';

          const s = await createSession({
            id: crypto.randomUUID(),
            studentId: expectedStudentId,
            providerId,
            startTime: startIso,
            endTime: endIso,
            scheduledStartTime: startIso,
            scheduledEndTime: endIso,
            scheduledStart: startIso,
            scheduledEnd: endIso,
            serviceType,
            serviceTypeId: serviceType,
            service_type: pricingServiceType,
            status: 'confirmed',
            stripeCheckoutSessionId: checkoutSession.id,
            stripePaymentIntentId: stripePaymentIntentId || undefined,
            // Optional helpful metadata (non-required)
            bookedAt: nowIso,
            bookedBy: expectedStudentId,
            session_index: i + 1,
            availabilityId: `${checkoutSession.id}#${i + 1}`,
            isPaid: true,
            plan,
            duration_minutes,
            sessionType: sessionTypeLabel,
            subject: subject || undefined,
            topic: topic ? topic : null,
            school: providerSchoolName || undefined,
            schoolId: providerSchoolId || undefined,
            studentName: studentName || undefined,
            providerName: providerName || undefined,
            studentProfileImage: studentProfileImage ?? null,
            providerProfileImage: providerProfileImage ?? null,
            session_price_cents: pricing.session_price_cents,
            tax_amount_cents: taxForThisSession,
            total_charge_cents: totalChargeForThisSession,
            provider_payout_cents: providerPayoutCents,
            providerPayout,
            providerPayoutCents,
            providerPayoutAmount: providerPayout,
            ivyway_take_cents: pricing.ivyway_take_cents,
            stripe_fee_cents: 0,
            // Backwards-compatible cents fields
            priceCents: pricing.session_price_cents,
            amountChargedCents: totalChargeForThisSession,
            amountRefundedCents: 0,
            earningsCredited: false,
          } as any);
          created.push(s);
          existingByTime.add(key);
        } catch (e) {
          // If the slot is already booked (e.g., webhook already created sessions but without stripeCheckoutSessionId),
          // treat as idempotent and continue. We'll return whatever exists.
          continue;
        }
      }
    }

    // Refresh sessions list for accurate return payload
    const refreshed = await getSessions();
    const sessionsForStripe = refreshed.filter(
      (s: any) => String((s as any)?.stripeCheckoutSessionId || '').trim() === checkoutSession.id
    );
    // Fallback: if sessions exist (e.g., created by another path) but do not carry stripeCheckoutSessionId,
    // return sessions matching the booked slots so the dashboard can show them immediately.
    const sessionsForSlots =
      sessionsForStripe.length > 0 || !providerId || sessionTimes.length === 0
        ? []
        : refreshed.filter((s: any) => {
            if (String(s?.studentId || '') !== expectedStudentId) return false;
            if (String(s?.providerId || '') !== providerId) return false;
            const sStart = s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
            const sEnd = s?.endTime || s?.scheduledEndTime || s?.scheduledEnd;
            const key = `${String(sStart || '')}|${String(sEnd || '')}`;
            return sessionTimes.some((t) => `${t.startIso}|${t.endIso}` === key);
          });
    const sessionsToReturn = sessionsForStripe.length > 0 ? sessionsForStripe : sessionsForSlots;

    // Best-effort cleanup of server-side booking record to prevent unbounded growth.
    if (checkoutBookingId) {
      try {
        await deleteCheckoutBookingRecord(checkoutBookingId);
      } catch {
        // ignore
      }
    }

    console.log('[CHECKOUT_SESSION_CONFIRMED]', {
      stripeSessionId: checkoutSession.id,
      createdCount: created.length,
    });

    // Return the session data (for receipt display) plus the finalized sessions
    return NextResponse.json({
      id: checkoutSession.id,
      payment_status: checkoutSession.payment_status,
      status: checkoutSession.status,
      metadata: checkoutSession.metadata,
      amount_subtotal: (checkoutSession as any).amount_subtotal ?? null,
      tax_amount: (checkoutSession as any)?.total_details?.amount_tax ?? null,
      amount_total: checkoutSession.amount_total,
      currency: checkoutSession.currency,
      sessions: sessionsToReturn,
    });
  } catch (error) {
    console.error('Error retrieving Stripe Checkout Session:', error);
    
    // If it's a Stripe error, log additional details
    if (error && typeof error === 'object' && 'type' in error) {
      console.error('[api/checkout-session] Stripe error type:', (error as any).type);
      console.error('[api/checkout-session] Stripe error code:', (error as any).code);
      console.error('[api/checkout-session] Stripe error message:', (error as any).message);
    }
    
    return handleApiError(error, { logPrefix: '[api/checkout-session]' });
  }
}





