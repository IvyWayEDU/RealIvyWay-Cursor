import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSession, getSessions, updateSession } from '@/lib/sessions/storage';
import crypto from 'crypto';
import { getUserById, getUsers, updateUser } from '@/lib/auth/storage';
import { createZoomMeeting, isZoomConfigured } from '@/lib/zoom/api';
import { getSessionPricingCents, ServiceType as PricingServiceType, Plan as PricingPlan } from '@/lib/pricing/catalog';
import { grantCounselingMonthlyCredits } from '@/lib/credits/counselingCredits.server';
import { getProviderPayout } from '@/lib/payouts/getProviderPayout';
import { deleteCheckoutBookingRecord, readCheckoutBookingRecord } from '@/lib/stripe/checkoutBookingStore.server';

// Initialize Stripe with secret key from environment variable
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Get webhook secret from environment variable
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getUserIdForStripeCustomer(customerId: string): Promise<string | null> {
  const id = String(customerId || '').trim();
  if (!id) return null;
  const users = await getUsers();
  const match = users.find((u: any) => String(u?.stripeCustomerId || '').trim() === id);
  return match?.id || null;
}

export async function POST(request: NextRequest) {
  // Check if Stripe is configured
  if (!stripe) {
    console.error('Stripe is not configured - STRIPE_SECRET_KEY is missing');
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 500 }
    );
  }

  // Check if webhook secret is configured
  if (!webhookSecret) {
    console.error('Stripe webhook secret is not configured - STRIPE_WEBHOOK_SECRET is missing');
    return NextResponse.json(
      { error: 'Webhook secret is not configured' },
      { status: 500 }
    );
  }

  // Read the raw body as text for signature verification
  // Stripe requires the raw body to verify the webhook signature
  const rawBody = await request.text();
  
  // Get the Stripe signature from headers
  const signature = request.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  // SECURITY FIX: Verify the webhook signature (critical for payment security)
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
    // SECURITY FIX: Log successful signature verification for audit trail
    console.log('[SECURITY] Stripe webhook signature verified:', { eventId: event.id, eventType: event.type });
  } catch (err) {
    // SECURITY FIX: Return 400 ONLY if signature verification fails - reject unsigned webhooks
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SECURITY] Webhook signature verification failed:', errorMessage);
    return NextResponse.json(
      { error: 'Webhook signature verification failed', details: errorMessage },
      { status: 400 }
    );
  }

  // Handle checkout.session.completed (payments + subscription activations)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Log the event ID and session metadata
    console.log('Checkout session completed - Event ID:', event.id);
    console.log('Checkout session completed - Session metadata:', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata || {},
    });

    try {
      // Keep stripeCustomerId in sync on first payment (best-effort)
      try {
        const md = session.metadata || {};
        const userId = typeof (md as any)?.userId === 'string' ? String((md as any).userId).trim() : '';
        const customerId = typeof (session as any)?.customer === 'string' ? String((session as any).customer).trim() : '';
        if (userId && customerId) {
          await updateUser(userId, {
            stripeCustomerId: customerId,
            stripeLastCheckoutSessionId: session.id,
            stripeLastCheckoutPaidAt: new Date().toISOString(),
          } as any);
        }
      } catch (e) {
        console.warn('[WEBHOOK] Failed to sync stripeCustomerId from checkout.session.completed (non-blocking)', e);
      }

      if (session.payment_status !== 'paid') {
        console.log('[WEBHOOK] checkout.session.completed received but payment_status is not paid', {
          stripeSessionId: session.id,
          paymentStatus: session.payment_status,
        });
        return NextResponse.json({ received: true });
      }

      // COUNSELING MONTHLY SUBSCRIPTION:
      // For subscription-mode Checkout, we DO NOT create sessions here.
      // Instead, we grant 4 counseling credits for the paid invoice (and rely on invoice.paid for renewals).
      if ((session as any)?.mode === 'subscription' || (session as any)?.subscription) {
        const md = session.metadata || {};
        const pricingKey = typeof (md as any)?.pricing_key === 'string' ? String((md as any).pricing_key).trim() : '';
        const serviceTypeRaw =
          typeof (md as any)?.service_type === 'string'
            ? String((md as any).service_type).trim().toLowerCase()
            : typeof (md as any)?.serviceType === 'string'
              ? String((md as any).serviceType).trim().toLowerCase()
              : '';
        const planRaw = typeof (md as any)?.plan === 'string' ? String((md as any).plan).trim().toLowerCase() : '';

        // Only handle counseling_monthly here; other subscription products (e.g. IvyWay AI) are out of scope for booking sessions.
        if (pricingKey === 'counseling_monthly' || (serviceTypeRaw === 'counseling' && planRaw === 'monthly')) {
          const userId = typeof (md as any)?.userId === 'string' ? String((md as any).userId).trim() : '';
          const subscriptionId = typeof (session as any)?.subscription === 'string' ? (session as any).subscription : '';
          const invoiceId = typeof (session as any)?.invoice === 'string' ? (session as any).invoice : '';

          if (!userId || !subscriptionId || !invoiceId) {
            console.error('[WEBHOOK] Missing fields for counseling monthly credit grant', {
              stripeSessionId: session.id,
              userId: userId || null,
              subscriptionId: subscriptionId || null,
              invoiceId: invoiceId || null,
            });
            return NextResponse.json({ received: true });
          }

          try {
            const grant = grantCounselingMonthlyCredits({
              userId,
              stripeSubscriptionId: subscriptionId,
              stripeInvoiceId: invoiceId,
              creditsToGrant: 4,
            });
            console.log('[COUNSELING_MONTHLY_CREDITS_GRANTED]', {
              stripeSessionId: session.id,
              userId,
              subscriptionId,
              invoiceId,
              ...grant,
            });
          } catch (e) {
            console.error('[COUNSELING_MONTHLY_CREDITS_GRANT_FAILED]', {
              stripeSessionId: session.id,
              userId,
              subscriptionId,
              invoiceId,
              error: e instanceof Error ? e.message : String(e),
            });
          }

          return NextResponse.json({ received: true });
        }
      }

      const metadata = session.metadata || {};
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

      if (!paymentIntentId) {
        console.error('[WEBHOOK] Missing payment_intent on checkout session; refusing to create sessions', {
          stripeSessionId: session.id,
        });
        return NextResponse.json({ received: true });
      }

      // STRIPE-ONLY SESSION CREATION (STRICT): verify paymentIntent.status === "succeeded"
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        console.log('[WEBHOOK] PaymentIntent not succeeded; refusing to create sessions', {
          stripeSessionId: session.id,
          paymentIntentId,
          status: paymentIntent.status,
        });
        return NextResponse.json({ received: true });
      }

      console.log('[STRIPE_PAYMENT_SUCCESS]', {
        stripeEventId: event.id,
        stripeSessionId: session.id,
        paymentIntentId,
        amountTotal: session.amount_total,
        currency: session.currency,
      });

      const isNonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
      const toIsoOrNull = (v: unknown): string | null => {
        if (!isNonEmpty(v)) return null;
        const d = new Date(String(v));
        return Number.isFinite(d.getTime()) ? d.toISOString() : null;
      };

      const normalizeServiceType = (raw: unknown): string => {
        const v = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/-/g, '_') : '';
        if (v === 'tutoring') return 'tutoring';
        if (v === 'college_counseling' || v === 'counseling') return 'college_counseling';
        if (v === 'virtual_tour' || v === 'virtual_tours') return 'virtual_tour';
        if (v === 'test_prep' || v === 'testprep') return 'test_prep';
        return '';
      };

      const parseClientReferenceId = (raw: unknown): {
        serviceType: string;
        studentId: string;
        providerId: string;
        startTime: string;
        endTime: string;
        checkoutBookingId?: string;
      } | null => {
        if (!isNonEmpty(raw)) return null;
        const parts = String(raw).split('|').map((p) => p.trim());
        if (parts.length < 6) return null;
        if (parts[0] !== 'ivyway') return null;
        const serviceType = normalizeServiceType(parts[1]);
        const studentId = parts[2] || '';
        const providerId = parts[3] || '';
        const startTime = parts[4] || '';
        const endTime = parts[5] || '';
        const checkoutBookingId =
          parts.length >= 7 && isNonEmpty(parts[6]) ? String(parts[6]).trim() : undefined;
        return { serviceType, studentId, providerId, startTime, endTime, checkoutBookingId };
      };

      const ctx = parseClientReferenceId((session as any).client_reference_id);
      const checkoutBooking =
        ctx?.checkoutBookingId ? await readCheckoutBookingRecord(ctx.checkoutBookingId) : null;
      const canonicalServiceType =
        normalizeServiceType((metadata as any).service_type) ||
        normalizeServiceType(metadata.serviceType) ||
        normalizeServiceType(metadata.service) ||
        ctx?.serviceType ||
        '';
      const studentId = (isNonEmpty(metadata.studentId) ? String(metadata.studentId).trim() : '') || (ctx?.studentId || '');
      const providerId =
        (isNonEmpty(metadata.providerId) ? String(metadata.providerId).trim() : '') || (ctx?.providerId || '');

      if (!canonicalServiceType) {
        console.error('[WEBHOOK] Missing/invalid serviceType; refusing to create session', {
          stripeSessionId: session.id,
          paymentIntentId,
        });
        return NextResponse.json({ received: true });
      }

      if (!studentId || !providerId) {
        console.error('[WEBHOOK] Missing participant ids; refusing to create session', {
          stripeSessionId: session.id,
          paymentIntentId,
        });
        return NextResponse.json({ received: true });
      }

      const snapshotStudentName = isNonEmpty(metadata.studentName) ? String(metadata.studentName).trim() : '';
      const snapshotProviderName = isNonEmpty(metadata.providerName) ? String(metadata.providerName).trim() : '';
      const snapshotStudentProfileImage = isNonEmpty(metadata.studentProfileImage) ? String(metadata.studentProfileImage).trim() : '';
      const snapshotProviderProfileImage = isNonEmpty(metadata.providerProfileImage) ? String(metadata.providerProfileImage).trim() : '';

      // Fallback snapshot fetch (still at creation-time; persisted into the session record)
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

      const studentUser = await getUserById(studentId);
      const providerUser = await getUserById(providerId);

      const studentName =
        snapshotStudentName ||
        (typeof (studentUser as any)?.name === 'string' ? String((studentUser as any).name).trim() : '');
      const providerName =
        snapshotProviderName ||
        (typeof (providerUser as any)?.name === 'string' ? String((providerUser as any).name).trim() : '');
      const studentProfileImage =
        snapshotStudentProfileImage || extractProfileImageUrl(studentUser) || null;
      const providerProfileImage =
        snapshotProviderProfileImage || extractProfileImageUrl(providerUser) || null;

      // Derive session times:
      // - Single-session: scheduledStart/scheduledEnd (or client_reference_id fallback)
      // - Bundle: server-side checkout store (preferred) or legacy sessionsJson metadata
      type SessionTime = { startIso: string; endIso: string };
      const sessionsFromCheckoutStore = (() => {
        if (!checkoutBooking || !Array.isArray(checkoutBooking.sessionTimes) || checkoutBooking.sessionTimes.length === 0) return null;
        const out: SessionTime[] = [];
        for (const item of checkoutBooking.sessionTimes) {
          const s = toIsoOrNull((item as any)?.scheduledStart);
          const e = toIsoOrNull((item as any)?.scheduledEnd);
          if (!s || !e) return null;
          const sMs = new Date(s).getTime();
          const eMs = new Date(e).getTime();
          if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) return null;
          out.push({ startIso: s, endIso: e });
        }
        return out;
      })();
      const sessionsFromMetadata = (() => {
        if (!isNonEmpty((metadata as any).sessionsJson)) return null;
        try {
          const raw = JSON.parse(String((metadata as any).sessionsJson));
          if (!Array.isArray(raw)) return null;
          const out: SessionTime[] = [];
          for (const item of raw) {
            const s = toIsoOrNull((item as any)?.scheduledStart);
            const e = toIsoOrNull((item as any)?.scheduledEnd);
            if (!s || !e) return null;
            const sMs = new Date(s).getTime();
            const eMs = new Date(e).getTime();
            if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) return null;
            out.push({ startIso: s, endIso: e });
          }
          return out;
        } catch {
          return null;
        }
      })();

      const singleStartIso =
        toIsoOrNull(metadata.scheduledStart || metadata.startTime) || (ctx?.startTime ? toIsoOrNull(ctx.startTime) : null);
      const singleEndIso =
        toIsoOrNull(metadata.scheduledEnd || metadata.endTime) || (ctx?.endTime ? toIsoOrNull(ctx.endTime) : null);

      const sessionTimes: SessionTime[] =
        sessionsFromCheckoutStore && sessionsFromCheckoutStore.length > 0
          ? sessionsFromCheckoutStore
          : sessionsFromMetadata && sessionsFromMetadata.length > 0
            ? sessionsFromMetadata
            : (singleStartIso && singleEndIso ? [{ startIso: singleStartIso, endIso: singleEndIso }] : []);

      if (sessionTimes.length === 0) {
        console.error('[WEBHOOK] Missing start/end times; refusing to create session(s)', {
          stripeSessionId: session.id,
          paymentIntentId,
        });
        return NextResponse.json({ received: true });
      }

      const subject =
        (checkoutBooking && isNonEmpty((checkoutBooking as any)?.subject) ? String((checkoutBooking as any).subject).trim() : '') ||
        (isNonEmpty(metadata.subject) ? String(metadata.subject).trim() : '');
      const topic =
        (checkoutBooking && isNonEmpty((checkoutBooking as any)?.topic) ? String((checkoutBooking as any).topic).trim() : '') ||
        (isNonEmpty((metadata as any)?.topic) ? String((metadata as any).topic).trim() : '');
      // School displayed on session/provider cards must come from the provider record (single source of truth),
      // not from booking payload / legacy cached fields.
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

      const existingSessions = await getSessions();
      const isActive = (status: any) => typeof status === 'string' && !status.startsWith('cancelled');
      // Idempotency: if we've already created ALL sessions for this paymentIntent, do nothing.
      const alreadyForPayment = existingSessions.filter((s: any) => s?.stripePaymentIntentId === paymentIntentId);
      const alreadyByTime = new Set<string>(
        alreadyForPayment.map((s: any) => {
          const sStart = s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
          const sEnd = s?.endTime || s?.scheduledEndTime || s?.scheduledEnd;
          return `${String(sStart || '')}|${String(sEnd || '')}`;
        })
      );
      if (alreadyForPayment.length >= sessionTimes.length) {
        return NextResponse.json({ received: true });
      }

      const nowIso = new Date().toISOString();

      // Pricing MUST come from the source-of-truth catalog, not from Stripe totals or slot length.
      const service_type: PricingServiceType | null =
        canonicalServiceType === 'tutoring'
          ? 'tutoring'
          : canonicalServiceType === 'test_prep'
            ? 'test_prep'
            : canonicalServiceType === 'virtual_tour'
              ? 'virtual_tour'
              : canonicalServiceType === 'college_counseling' || canonicalServiceType === 'counseling'
                ? 'counseling'
                : null;

      if (!service_type) {
        console.error('[WEBHOOK] Unsupported service_type; refusing to create sessions', {
          stripeSessionId: session.id,
          paymentIntentId,
          canonicalServiceType,
        });
        return NextResponse.json({ received: true });
      }

      const planRaw =
        checkoutBooking?.plan
          ? String(checkoutBooking.plan).trim().toLowerCase()
          : (isNonEmpty((metadata as any).plan) ? String((metadata as any).plan).trim().toLowerCase() : 'single');
      const plan: PricingPlan =
        planRaw === 'monthly' ? 'monthly' : planRaw === 'yearly' ? 'yearly' : 'single';

      // Counseling is 60 minutes only; ignore any legacy "30" metadata if present.
      const duration_minutes: 60 | null = service_type === 'counseling' ? 60 : null;

      let pricing: ReturnType<typeof getSessionPricingCents>;
      try {
        pricing = getSessionPricingCents({ service_type, plan, duration_minutes });
      } catch (e) {
        console.error('[WEBHOOK] Pricing lookup failed; refusing to create sessions', {
          stripeSessionId: session.id,
          paymentIntentId,
          service_type,
          plan,
          duration_minutes,
          error: e instanceof Error ? e.message : String(e),
        });
        return NextResponse.json({ received: true });
      }

      // Stripe Tax:
      // - amount_subtotal is the pre-tax price total (what our pricing catalog defines)
      // - total_details.amount_tax is the tax amount added on top (price must be tax-exclusive)
      // - amount_total = amount_subtotal + amount_tax (+ other adjustments, which we do not use)
      const stripeSubtotalCents =
        typeof (session as any).amount_subtotal === 'number'
          ? (session as any).amount_subtotal
          : (typeof session.amount_total === 'number' ? session.amount_total : 0);
      const stripeTaxCents =
        typeof (session as any)?.total_details?.amount_tax === 'number'
          ? Math.max(0, Math.floor((session as any).total_details.amount_tax))
          : 0;
      const stripeTotalCents = typeof session.amount_total === 'number' ? session.amount_total : 0;

      const expectedSubtotal = pricing.purchase_price_cents;
      if (stripeSubtotalCents !== expectedSubtotal) {
        console.error('[WEBHOOK][PRICING_MISMATCH] Stripe amount_subtotal != expected (catalog base price)', {
          stripeSessionId: session.id,
          paymentIntentId,
          stripeSubtotalCents,
          expectedSubtotal,
          pricing_key: pricing.pricing_key,
        });
        // Do not mutate Stripe history; still proceed to create sessions with catalog values so
        // internal earnings/payout logic is consistent and auditable.
      }
      if (stripeTotalCents && stripeTotalCents !== stripeSubtotalCents + stripeTaxCents) {
        console.error('[WEBHOOK][TOTAL_MISMATCH] Stripe amount_total != subtotal + tax', {
          stripeSessionId: session.id,
          paymentIntentId,
          stripeSubtotalCents,
          stripeTaxCents,
          stripeTotalCents,
          pricing_key: pricing.pricing_key,
        });
      }

      if (sessionTimes.length !== pricing.sessions_per_purchase) {
        console.error('[WEBHOOK] Session count mismatch; refusing to create sessions', {
          stripeSessionId: session.id,
          paymentIntentId,
          selectedCount: sessionTimes.length,
          requiredCount: pricing.sessions_per_purchase,
          pricing_key: pricing.pricing_key,
        });
        return NextResponse.json({ received: true });
      }

      // Allocate Stripe tax across sessions (bundles create N sessions from one Checkout payment).
      const totalTaxCents = stripeTaxCents;
      const taxBasePerSession = Math.floor(totalTaxCents / pricing.sessions_per_purchase);
      const taxRemainder = totalTaxCents - taxBasePerSession * pricing.sessions_per_purchase;

      const sessionType =
        canonicalServiceType === 'tutoring'
          ? 'tutoring'
          : canonicalServiceType === 'test_prep'
            ? 'test-prep'
            : 'counseling';

      for (let i = 0; i < sessionTimes.length; i++) {
        const { startIso, endIso } = sessionTimes[i];
        const key = `${startIso}|${endIso}`;
        if (alreadyByTime.has(key)) continue;

        const taxForThisSession = taxBasePerSession + (i < taxRemainder ? 1 : 0);
        const totalChargeForThisSession = pricing.session_price_cents + taxForThisSession;

        // Double-book prevention (active sessions only)
        const alreadySlot = existingSessions.find((s: any) => {
          const sStart = s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
          const sEnd = s?.endTime || s?.scheduledEndTime || s?.scheduledEnd;
          return s?.providerId === providerId && sStart === startIso && sEnd === endIso && isActive(s?.status);
        });
        if (alreadySlot) continue;

        const startMs = new Date(startIso).getTime();
        const endMs = new Date(endIso).getTime();
        const durationMinutes = Math.round((endMs - startMs) / (1000 * 60));
        const perSessionCents = pricing.session_price_cents;
        const payoutServiceType = service_type === 'counseling' ? 'college_counseling' : service_type;
        const providerPayout = getProviderPayout(payoutServiceType);
        const providerPayoutCents = Math.max(0, Math.floor(providerPayout * 100));

        // IMPORTANT: Session creation ALWAYS happens first.
        const created = await createSession({
          id: crypto.randomUUID(),
          studentId,
          providerId,
          serviceType: service_type === 'counseling' ? 'college_counseling' : service_type,
          serviceTypeId: service_type === 'counseling' ? 'college_counseling' : service_type,
          service_type,
          plan,
          // 1-based index for bundled session creation (monthly plans create 4 sessions).
          session_index: i + 1,
          duration_minutes,
          sessionType,
          subject: subject || undefined,
          topic:
            (service_type === 'tutoring' || service_type === 'test_prep') && topic
              ? topic
              : null,
          school: providerSchoolName || undefined,
          schoolId: providerSchoolId || undefined,
          startTime: startIso,
          endTime: endIso,
          scheduledStartTime: startIso,
          scheduledEndTime: endIso,
          scheduledStart: startIso,
          scheduledEnd: endIso,
          status: 'confirmed',
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: session.id,
          stripe_price_id: isNonEmpty((metadata as any).stripe_price_id) ? String((metadata as any).stripe_price_id).trim() : undefined,
          studentName: studentName || undefined,
          providerName: providerName || undefined,
          studentProfileImage: studentProfileImage ?? null,
          providerProfileImage: providerProfileImage ?? null,
          // Canonical cents fields (immutable once booked)
          session_price_cents: pricing.session_price_cents,
          tax_amount_cents: taxForThisSession,
          total_charge_cents: totalChargeForThisSession,
          provider_payout_cents: providerPayoutCents,
          providerPayout,
          providerPayoutCents,
          providerPayoutAmount: providerPayout,
          // Virtual Tours: explicit provider pay snapshot (USD dollars) for downstream metadata compatibility.
          providerPay: payoutServiceType === 'virtual_tour' ? providerPayout : undefined,
          ivyway_take_cents: pricing.ivyway_take_cents,
          stripe_fee_cents: 0,
          // Backwards-compatible cents fields
          priceCents: perSessionCents,
          // Represents what the student was charged (per-session allocation; includes tax).
          amountChargedCents: totalChargeForThisSession,
          amountRefundedCents: 0,
          isPaid: true,
          earningsCredited: false,
          bookedAt: nowIso,
          bookedBy: studentId,
          availabilityId: `${session.id}#${i + 1}`,
        } as any);

        // Best-effort Zoom meeting creation (must NOT block booking).
        if (isZoomConfigured()) {
          try {
            const topic =
              canonicalServiceType === 'tutoring'
                ? `Tutoring${subject ? ` - ${subject}` : ''}`
                : canonicalServiceType === 'test_prep'
                  ? `Test Prep${subject ? ` - ${subject}` : ''}`
                  : canonicalServiceType === 'virtual_tour'
                    ? `Virtual Tour${providerSchoolName ? ` - ${providerSchoolName}` : ''}`
                    : `College Counseling${providerSchoolName ? ` - ${providerSchoolName}` : ''}`;

            const zoom = await createZoomMeeting({
              topic,
              startTime: startIso,
              duration: durationMinutes,
            });

            const patched = await updateSession(created.id, {
              zoomMeetingId: zoom.meetingId,
              zoomJoinUrl: zoom.joinUrl,
              zoomStartUrl: zoom.startUrl,
              zoomStatus: 'created',
            } as any);

            console.log('[ZOOM_MEETING_CREATED]', {
              stripeSessionId: session.id,
              paymentIntentId,
              sessionId: created.id,
              providerId,
              studentId,
              zoomMeetingId: zoom.meetingId,
              patched,
              startTime: startIso,
              endTime: endIso,
            });
          } catch (error) {
            console.error('[ZOOM_MEETING_CREATE_FAILED]', {
              stripeSessionId: session.id,
              paymentIntentId,
              sessionId: created.id,
              providerId,
              studentId,
              startTime: startIso,
              endTime: endIso,
              error: error instanceof Error ? error.message : String(error),
            });
            // Persist failure state, but never block booking.
            try {
              await updateSession(created.id, { zoomStatus: 'failed' } as any);
            } catch {}
          }
        }

        // Availability is READ-ONLY. Booked slots are excluded via sessions + reserved slots.

        console.log('[SESSION_CREATED]', {
          sessionId: created.id,
          stripeSessionId: session.id,
          paymentIntentId,
          providerId,
          studentId,
          serviceType: canonicalServiceType,
          startTime: startIso,
          endTime: endIso,
          zoomMeetingId: (created as any)?.zoomMeetingId || null,
        });
      }

      // Always return 200 to Stripe to acknowledge receipt
      // Best-effort cleanup of server-side booking record (prevents unbounded growth).
      if (ctx?.checkoutBookingId) {
        try {
          await deleteCheckoutBookingRecord(ctx.checkoutBookingId);
        } catch {}
      }
      return NextResponse.json({ received: true });
    } catch (error) {
      // Log error but still return 200 to Stripe
      console.error('Error updating booking status to paid:', {
        stripeSessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Always return 200 to Stripe to acknowledge receipt
      return NextResponse.json({ received: true });
    }
  }

  // Keep customer profile info in sync (best-effort)
  if (event.type === 'customer.updated') {
    const customer = event.data.object as Stripe.Customer;
    try {
      const customerId = String(customer.id || '').trim();
      const mdUserId = typeof (customer as any)?.metadata?.userId === 'string' ? String((customer as any).metadata.userId).trim() : '';
      const userId = mdUserId || (customerId ? await getUserIdForStripeCustomer(customerId) : null) || '';
      if (userId && customerId) {
        const defaultPm =
          typeof (customer as any)?.invoice_settings?.default_payment_method === 'string'
            ? String((customer as any).invoice_settings.default_payment_method).trim()
            : '';
        await updateUser(userId, {
          stripeCustomerId: customerId,
          stripeCustomerEmail: customer.email || undefined,
          stripeCustomerName: customer.name || undefined,
          stripeDefaultPaymentMethodId: defaultPm || undefined,
          stripeCustomerUpdatedAt: new Date().toISOString(),
        } as any);
      }
    } catch (e) {
      console.warn('[WEBHOOK] customer.updated handling failed (non-blocking):', e);
    }
    return NextResponse.json({ received: true });
  }

  // Keep payment method attachment info in sync (best-effort)
  if (event.type === 'payment_method.attached') {
    const pm = event.data.object as Stripe.PaymentMethod;
    try {
      const customerId = typeof (pm as any)?.customer === 'string' ? String((pm as any).customer).trim() : '';
      const userId = customerId ? await getUserIdForStripeCustomer(customerId) : null;
      if (userId && customerId) {
        await updateUser(userId, {
          stripeCustomerId: customerId,
          stripeLastPaymentMethodId: pm.id,
          stripeLastPaymentMethodAttachedAt: new Date().toISOString(),
        } as any);
      }
    } catch (e) {
      console.warn('[WEBHOOK] payment_method.attached handling failed (non-blocking):', e);
    }
    return NextResponse.json({ received: true });
  }

  // Grant counseling monthly credits on invoice.paid (covers renewals).
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    try {
      // Stripe typings have changed across API versions; access defensively.
      const subscriptionId = typeof (invoice as any)?.subscription === 'string' ? String((invoice as any).subscription).trim() : '';
      const invoiceId = invoice.id;
      if (!subscriptionId || !invoiceId) return NextResponse.json({ received: true });

      // Retrieve subscription to verify it's the counseling monthly plan + get userId from metadata.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const md = (subscription as any)?.metadata || {};
      const userId = typeof md?.userId === 'string' ? String(md.userId).trim() : '';
      const pricingKey = typeof md?.pricing_key === 'string' ? String(md.pricing_key).trim() : '';

      if (pricingKey !== 'counseling_monthly') {
        return NextResponse.json({ received: true });
      }
      if (!userId) {
        console.error('[WEBHOOK] Missing userId on subscription metadata for counseling monthly', {
          subscriptionId,
          invoiceId,
        });
        return NextResponse.json({ received: true });
      }

      const grant = grantCounselingMonthlyCredits({
        userId,
        stripeSubscriptionId: subscriptionId,
        stripeInvoiceId: invoiceId,
        creditsToGrant: 4,
      });
      console.log('[COUNSELING_MONTHLY_CREDITS_GRANTED_INVOICE]', {
        userId,
        subscriptionId,
        invoiceId,
        ...grant,
      });
    } catch (e) {
      console.error('[WEBHOOK] invoice.paid handling failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Also keep billing info in sync for any invoice paid (best-effort)
    try {
      const customerId = typeof invoice.customer === 'string' ? String(invoice.customer).trim() : '';
      const userId = customerId ? await getUserIdForStripeCustomer(customerId) : null;
      if (userId && customerId) {
        await updateUser(userId, {
          stripeCustomerId: customerId,
          stripeLastInvoicePaidId: invoice.id,
          stripeLastInvoicePaidAt: new Date().toISOString(),
          stripeLastInvoiceAmountPaidCents: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : undefined,
        } as any);
      }
    } catch (e) {
      console.warn('[WEBHOOK] invoice.paid billing sync failed (non-blocking):', e);
    }
    return NextResponse.json({ received: true });
  }

  // For all other event types, immediately return 200
  return NextResponse.json({ received: true });
}


