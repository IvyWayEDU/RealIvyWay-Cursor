import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { getAuthContext } from '@/lib/auth/session';
import { getUserById, getUsers } from '@/lib/auth/storage';
import { reserveSlotsAtomically, unreserveSlotsAtomically } from '@/lib/availability/store.server';
import { getSessionPricingCents, ServiceType as PricingServiceType, Plan as PricingPlan } from '@/lib/pricing/catalog';
import {
  debugLogStripePriceIdMapKeysOnce,
  debugLogStripePriceIdMapDetailsOnce,
  getStripePriceIdForPricingKey,
  getStripePriceIdMapDebugInfo,
} from '@/lib/pricing/stripePriceIds';
import {
  deleteCheckoutBookingRecord,
  setCheckoutBookingCheckoutSessionId,
  writeCheckoutBookingRecord,
} from '@/lib/stripe/checkoutBookingStore.server';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { assertNoStudentDoubleBooking, DOUBLE_BOOKING_MESSAGE, DoubleBookingError } from '@/lib/sessions/doubleBooking.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

// Initialize Stripe with secret key from environment variable
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    const stripeDebug = process.env.STRIPE_DEBUG === '1';
    if (stripeDebug) {
      console.log('CHECKOUT process.cwd():', process.cwd());
      console.log('CHECKOUT env presence:', {
        hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
        hasStripePriceIdsJson: !!process.env.STRIPE_PRICE_IDS_JSON,
        nodeEnv: process.env.NODE_ENV,
      });
    }

    // Verify user session
    const auth = await getAuthContext();
    if (auth.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }
    if (auth.status !== 'ok') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = auth.session;
    const user = session.user;
    if (!user?.email || typeof user.email !== 'string' || !user.email.trim()) {
      return NextResponse.json({ error: 'Missing user email for checkout' }, { status: 422 });
    }

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/checkout',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    // Parse request body
    let normalizedServiceType = '';
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      console.error('[CHECKOUT_400_DEBUG]', {
        body,
        normalizedServiceType,
      });
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const bookingState = body?.bookingState;
    const bodyIdempotencyKey =
      typeof body?.idempotencyKey === 'string' && String(body.idempotencyKey).trim()
        ? String(body.idempotencyKey).trim()
        : '';

    // Production safety: avoid logging full request payload (can contain PII).
    if (stripeDebug) {
      console.log('CHECKOUT REQUEST BODY keys:', body && typeof body === 'object' ? Object.keys(body) : typeof body);
    }

    // Validate required inputs exist (sent by frontend summary page).
    const providerIdInput = typeof body?.providerId === 'string' ? String(body.providerId).trim() : '';
    const sessionDateInput = typeof body?.sessionDate === 'string' ? String(body.sessionDate).trim() : '';
    const sessionTimeInput = typeof body?.sessionTime === 'string' ? String(body.sessionTime).trim() : '';
    const pricingKeyInput = typeof body?.pricingKey === 'string' ? String(body.pricingKey).trim() : '';

    if (!pricingKeyInput) {
      console.error('[CHECKOUT_400_DEBUG]', {
        body,
        normalizedServiceType,
      });
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Get base URL for redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (request.headers.get('origin') || 'http://localhost:3000');
    if (stripeDebug) console.log('CHECKOUT baseUrl:', baseUrl);

    // Stripe must be configured for production checkout (no mock fallbacks).
    if (!stripe) {
      return NextResponse.json(
        { success: false, message: 'Payments are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Build booking metadata for webhook session creation
    // NOTE: Stripe metadata values must be strings and have size limits.
    const studentId = session.userId;
    const providerIdRaw = providerIdInput || (bookingState?.provider as string | undefined) || '';
    const providerId = String(providerIdRaw || '').trim();
    const serviceRaw = (bookingState?.service as string | undefined) || '';
    const subjectRaw = (bookingState?.subject as string | null | undefined) || '';
    const topicRaw = (bookingState?.topic as string | null | undefined) || '';
    // School can be shaped as canonical { id, name } (BookingFlowClient), or legacy { normalizedName, displayName } (older summary page).
    const schoolIdRaw =
      (bookingState?.school?.id as string | undefined) ||
      (bookingState?.school?.normalizedName as string | undefined) ||
      (bookingState?.schoolId as string | undefined) ||
      '';
    const schoolNameRaw =
      (bookingState?.school?.name as string | undefined) ||
      (bookingState?.school?.displayName as string | undefined) ||
      (bookingState?.schoolName as string | undefined) ||
      '';

    // Canonical service type (paid booking services)
    const normalizedService = String(serviceRaw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const serviceType = normalizedService;
    const originalServiceType = serviceType;

    // Availability normalization (virtual tours reuse counseling availability/booking behavior).
    let normalizedAvailabilityServiceType = serviceType;
    if (serviceType === 'virtual_tour' || serviceType === 'virtual_tours') {
      normalizedAvailabilityServiceType = 'college_counseling';
    }

    // Pricing normalization (IMPORTANT: virtual_tour must stay virtual_tour for pricing).
    let normalizedPricingServiceType = serviceType;
    if (normalizedPricingServiceType === 'virtual_tours') {
      normalizedPricingServiceType = 'virtual_tour';
    }

    // Backwards-compatible variable used throughout booking/session logic.
    normalizedServiceType = normalizedAvailabilityServiceType;

    const canonicalPricingServiceType: PricingServiceType | null =
      normalizedPricingServiceType === 'tutoring'
        ? 'tutoring'
        : normalizedPricingServiceType === 'college_counseling' || normalizedPricingServiceType === 'counseling'
          ? 'counseling'
          : normalizedPricingServiceType === 'virtual_tour' || normalizedPricingServiceType === 'virtual_tours'
            ? 'virtual_tour'
            : normalizedPricingServiceType === 'test_prep' || normalizedPricingServiceType === 'testprep'
              ? 'test_prep'
              : null;

    if (!canonicalPricingServiceType) {
      console.error('[CHECKOUT_400_DEBUG]', {
        body,
        normalizedServiceType,
        normalizedAvailabilityServiceType,
        normalizedPricingServiceType,
      });
      return NextResponse.json(
        { error: 'Unsupported service type for booking' },
        { status: 400 }
      );
    }

    const subject = String(subjectRaw || '').trim();
    const topic = String(topicRaw || '').trim();
    const schoolId = String(schoolIdRaw || '').trim();
    const schoolName = String(schoolNameRaw || '').trim();

    // `school` is optional for counseling (including normalized virtual tours).
    if (normalizedServiceType === 'college_counseling') {
      if (!schoolId && !schoolName) {
        console.warn('[CHECKOUT_MISSING_SCHOOL]', {
          serviceType,
          normalizedServiceType,
        });
      }
    }

    // NOTE: Subject/school are not required for session creation.
    // Booking integrity is enforced by provider/time + Stripe payment + confirmed session persistence.

    const selectedSessions: Array<any> = Array.isArray(bookingState?.selectedSessions) ? bookingState.selectedSessions : [];

    // Normalize plan + duration strictly (pricing selection MUST NOT be inferred from slot length).
    const planRaw = (bookingState?.plan as string | null | undefined) || null;
    const planNorm = String(planRaw || '').trim().toLowerCase();

    const pricingPlan: PricingPlan =
      planNorm.endsWith('-monthly') || planNorm === 'monthly' || planNorm === 'counseling-monthly'
        ? 'monthly'
        : planNorm.endsWith('-yearly') || planNorm === 'yearly'
          ? 'yearly'
          : 'single';

    // Counseling is 60 minutes only; duration selection is not allowed.
    const duration_minutes: 60 | null = canonicalPricingServiceType === 'counseling' ? 60 : null;

    const pricing = getSessionPricingCents({
      service_type: canonicalPricingServiceType,
      plan: pricingPlan,
      duration_minutes,
    });

    const expectedPricingKey =
      pricingPlan === 'single'
        ? normalizedPricingServiceType === 'tutoring'
          ? 'tutoring_single'
          : normalizedPricingServiceType === 'college_counseling' || normalizedPricingServiceType === 'counseling'
            ? 'counseling_single'
            : normalizedPricingServiceType === 'virtual_tour' || normalizedPricingServiceType === 'virtual_tours'
              ? 'virtual_tour_single'
              : pricing.pricing_key
        : pricing.pricing_key;

    console.log('[CHECKOUT_SERVICE_SPLIT_DEBUG]', {
      originalServiceType,
      normalizedAvailabilityServiceType,
      normalizedPricingServiceType,
      pricingKeyInput,
      expectedPricingKey,
    });

    if (stripeDebug) {
      console.log('CHECKOUT resolved pricing object:', pricing);
      console.log('CHECKOUT pricingKeyInput vs server pricing_key:', {
        pricingKeyInput,
        serverPricingKey: pricing.pricing_key,
      });
    }

    // Client provides pricingKey for validation/debugging only; server pricing is authoritative.
    if (pricingKeyInput !== expectedPricingKey) {
      if (normalizedPricingServiceType === 'college_counseling' || normalizedPricingServiceType === 'counseling') {
        console.warn('[CHECKOUT_PRICING_KEY_MISMATCH_NONBLOCKING]', {
          pricingKeyInput,
          expectedPricingKey,
          normalizedServiceType,
          normalizedAvailabilityServiceType,
          normalizedPricingServiceType,
        });
      } else {
        console.error('[CHECKOUT_400_DEBUG]', {
          body,
          normalizedServiceType,
          normalizedAvailabilityServiceType,
          normalizedPricingServiceType,
        });
        return NextResponse.json(
          { error: `Invalid pricingKey (expected "${expectedPricingKey}")` },
          { status: 400 }
        );
      }
    }

    const pricingKey = pricing.pricing_key;
    const sessionDate = sessionDateInput;
    const sessionTime = sessionTimeInput;

    // Debug: print active Stripe price map keys + source once per runtime.
    if (stripeDebug) {
      debugLogStripePriceIdMapKeysOnce('CHECKOUT STRIPE_PRICE_IDS');
      debugLogStripePriceIdMapDetailsOnce('CHECKOUT STRIPE_PRICE_IDS');
    }

    let stripePriceId: string;
    try {
      stripePriceId = getStripePriceIdForPricingKey(pricingKey);
    } catch (e) {
      console.error('CHECKOUT failed to resolve Stripe price id:', e);
      return NextResponse.json(
        { success: false, message: 'Payments are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Production-safe debug logs (requested). Do NOT log secrets.
    if (stripeDebug) {
      console.log('[CHECKOUT DEBUG]', {
        pricingKey,
        stripePriceId,
        providerId,
        sessionDate,
        sessionTime,
        baseUrl,
        successUrl: `${baseUrl}/dashboard/book/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/dashboard/book/summary?canceled=true`,
        hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
        hasStripePriceIdsJson: !!process.env.STRIPE_PRICE_IDS_JSON,
      });
      console.log('CHECKOUT pricing key:', pricingKey);
      console.log('CHECKOUT stripe price id:', stripePriceId);
      try {
        const info = getStripePriceIdMapDebugInfo();
        console.log('CHECKOUT stripe price map source:', info.source);
        console.log('CHECKOUT stripe price map keys:', info.keys);
        console.log('CHECKOUT stripe price map cwd:', info.cwd);
        console.log('CHECKOUT stripe price map fallback file path:', info.fallbackFilePath);
        console.log('CHECKOUT stripe price map tutoring_single:', info.tutoringSingle);
      } catch (e) {
        console.warn('CHECKOUT failed to read Stripe price map debug info:', e);
      }
    }

    // Monthly plans (including counseling_monthly) are bundle purchases:
    // Stripe is charged ONCE and the webhook creates sessions_per_purchase session records.

    // Bundle requirements come from pricing catalog.
    const requiredSessionCount = pricing.sessions_per_purchase;

    // Used only to compute end-time for legacy (date,time) session shapes.
    const durationMinutesForEnd = 60;

    const buildStartEnd = (dateIso: string, timeLabel: string): { start: string; end: string } | null => {
      const date = new Date(dateIso);
      if (isNaN(date.getTime())) return null;
      const [time, period] = String(timeLabel).split(' ');
      const [hh, mm] = time.split(':');
      let hour24 = parseInt(hh, 10);
      const minute = parseInt(mm || '0', 10);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;
      date.setHours(hour24, minute, 0, 0);
      const start = date.toISOString();
      const end = new Date(date.getTime() + (durationMinutesForEnd || 60) * 60 * 1000).toISOString();
      return { start, end };
    };

    const allPayloads = selectedSessions
      .map((s) => {
        // New canonical shape from BookingFlowClient
        const startTimeUTC = typeof s?.startTimeUTC === 'string' ? s.startTimeUTC : null;
        const endTimeUTC = typeof s?.endTimeUTC === 'string' ? s.endTimeUTC : null;
        const startEnd =
          startTimeUTC && endTimeUTC
            ? (() => {
                const startD = new Date(startTimeUTC);
                const endD = new Date(endTimeUTC);
                if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD <= startD) return null;
                return { start: startD.toISOString(), end: endD.toISOString() };
              })()
            : buildStartEnd(s?.date, s?.time);

        if (!startEnd) return null;
        return {
          studentId,
          providerId,
          serviceType: normalizedServiceType,
          subject: normalizedAvailabilityServiceType === 'tutoring' || normalizedAvailabilityServiceType === 'test_prep' ? subject : '',
          school: normalizedAvailabilityServiceType === 'college_counseling' ? schoolName : '',
          schoolId: schoolId || undefined,
          scheduledStart: startEnd.start,
          scheduledEnd: startEnd.end,
        };
      })
      .filter(Boolean) as Array<Record<string, string | undefined>>;

    // Enforce required selection count for bundles (backend safety).
    // For single-session plans we keep backwards-compatible behavior: accept >= 1 and use the first slot.
    if (requiredSessionCount > 1) {
      if (allPayloads.length !== requiredSessionCount) {
        console.error('[CHECKOUT_400_DEBUG]', {
          body,
          normalizedServiceType,
        });
        return NextResponse.json(
          {
            error:
              requiredSessionCount === 4
                ? 'Monthly bundle requires selection of ALL 4 session times'
                : 'Monthly plan requires selection of ALL 2 session times',
          },
          { status: 400 }
        );
      }
    } else {
      if (allPayloads.length < 1) {
        console.error('[CHECKOUT_400_DEBUG]', {
          body,
          normalizedServiceType,
        });
        return NextResponse.json({ error: 'At least one session time is required' }, { status: 400 });
      }
    }

    const sessionPayloads = requiredSessionCount > 1 ? allPayloads : allPayloads.slice(0, 1);

    // Require providerId to be the REAL provider auth userId (no fallback picking).
    const isValidProviderUserId = async (id: string): Promise<boolean> => {
      if (!id) return false;
      const u = await getUserById(id);
      return !!u && Array.isArray((u as any).roles) && (u as any).roles.includes('provider');
    };

    if (!providerId) {
      console.error('[CHECKOUT_400_DEBUG]', {
        body,
        normalizedServiceType,
      });
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    if (!(await isValidProviderUserId(providerId))) {
      console.error('[CHECKOUT_400_DEBUG]', {
        body,
        normalizedServiceType,
      });
      return NextResponse.json(
        { error: 'Invalid providerId (must be a real provider user id)' },
        { status: 400 }
      );
    }

    if (sessionPayloads.length === 0) {
      console.error('[CHECKOUT_400_DEBUG]', {
        body,
        normalizedServiceType,
      });
      return NextResponse.json(
        { error: 'At least one session time is required' },
        { status: 400 }
      );
    }

    // Enforce all selected sessions are for the same providerId (booking integrity)
    for (const p of sessionPayloads) {
      if (p.providerId !== providerId) {
        console.error('[CHECKOUT_400_DEBUG]', {
          body,
          normalizedServiceType,
        });
        return NextResponse.json(
          { error: 'All selected sessions must use the same providerId' },
          { status: 400 }
        );
      }
    }

    const TEN_MIN_MS = 10 * 60 * 1000;
    const firstSlotStartTime = String((sessionPayloads?.[0] as any)?.scheduledStart || '').trim();
    const idempotencyKey =
      bodyIdempotencyKey || `${providerId}_${firstSlotStartTime}_${normalizedPricingServiceType}`;

    const supabase = getSupabaseAdmin();

    const normalizeService = (raw: unknown): string => {
      return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    };

    const isBookedSessionRow = (row: any): boolean => {
      const status = typeof row?.status === 'string' ? String(row.status).trim().toLowerCase() : '';
      const isPaid = row?.data?.isPaid === true || row?.data?.is_paid === true;
      const isBooked = row?.data?.is_booked === true || row?.data?.isBooked === true;
      return status === 'completed' || status === 'confirmed' || isPaid || isBooked;
    };

    // PART 2/3/4/6: check for existing recent session before proceeding (retry-safe).
    // We only block TRUE duplicates (already booked/paid/completed).
    for (const p of sessionPayloads as any[]) {
      const startTime = String(p?.scheduledStart || '').trim();
      const endTime = String(p?.scheduledEnd || '').trim();
      if (!startTime || !endTime) continue;

      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('provider_id', providerId)
        .eq('datetime', startTime)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const existingServiceType =
        existingSession?.data?.serviceType ??
        existingSession?.data?.service_type ??
        existingSession?.data?.serviceTypeId ??
        null;
      const matchesServiceType =
        existingSession ? normalizeService(existingServiceType) === normalizeService(normalizedAvailabilityServiceType) : false;

      const isRecent =
        !!existingSession &&
        matchesServiceType &&
        new Date(String(existingSession.created_at || '')).getTime() > Date.now() - TEN_MIN_MS;

      console.log('[CHECKOUT_RETRY_DEBUG]', {
        providerId,
        startTime,
        existingSession: !!existingSession && matchesServiceType,
        reused: isRecent,
      });

      if (existingSession && matchesServiceType) {
        if (isBookedSessionRow(existingSession)) {
          return NextResponse.json({ error: 'Slot already booked' }, { status: 409 });
        }

        if (isRecent) {
          console.log('[CHECKOUT_RETRY_RECOVERED]', {
            providerId,
            startTime,
            reusedSessionId: existingSession?.id,
          });
          // Continue checkout flow (retry-safe): do NOT fail 409 for a recent, non-booked session row.
        }
      }
    }

    // PART 1/5: idempotency via bookings table + Stripe session reuse.
    // If the user hit "back" and retries, we prefer returning the same in-flight Stripe checkout.
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id, checkout_session_id, created_at, data')
      .eq('data->>idempotencyKey', idempotencyKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bookingMatches =
      !!existingBooking &&
      typeof (existingBooking as any)?.data === 'object' &&
      String((existingBooking as any).data?.studentId || '') === studentId &&
      String((existingBooking as any).data?.providerId || '') === providerId &&
      normalizeService((existingBooking as any).data?.serviceType) === normalizeService(normalizedServiceType) &&
      new Date(String((existingBooking as any).created_at || '')).getTime() > Date.now() - TEN_MIN_MS;

    const existingCheckoutSessionId =
      bookingMatches && typeof (existingBooking as any)?.checkout_session_id === 'string'
        ? String((existingBooking as any).checkout_session_id).trim()
        : '';

    if (existingCheckoutSessionId) {
      try {
        const prev = await stripe.checkout.sessions.retrieve(existingCheckoutSessionId);
        const prevStatus = typeof prev?.status === 'string' ? prev.status : '';
        const prevPaid = prev?.payment_status === 'paid' || prevStatus === 'complete';

        if (prevPaid) {
          return NextResponse.json({ error: 'Slot already booked' }, { status: 409 });
        }

        if (prev?.url) {
          console.log('[CHECKOUT_RETRY_RECOVERED]', {
            providerId,
            startTime: firstSlotStartTime,
            reusedSessionId: null,
            reusedCheckoutSessionId: prev.id,
            bookingId: (existingBooking as any)?.id,
          });
          return NextResponse.json({ sessionId: prev.id, url: prev.url });
        }
      } catch (e) {
        // Non-blocking: if Stripe session can't be retrieved, proceed to create a new one.
        console.warn('[CHECKOUT_RETRY_STRIPE_RETRIEVE_FAILED]', {
          providerId,
          startTime: firstSlotStartTime,
          checkoutSessionId: existingCheckoutSessionId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Prevent students from double-booking overlapping sessions (across ALL services).
    try {
      for (const p of sessionPayloads as any[]) {
        const scheduledStart = String(p?.scheduledStart || '').trim();
        const scheduledEnd = String(p?.scheduledEnd || '').trim();
        if (!scheduledStart || !scheduledEnd) continue;
        await assertNoStudentDoubleBooking({
          studentId,
          newStart: scheduledStart,
          newEnd: scheduledEnd,
        });
      }
    } catch (e) {
      if (e instanceof DoubleBookingError) {
        console.error('[CHECKOUT_400_DEBUG]', {
          body,
          normalizedServiceType,
        });
        return NextResponse.json({ error: DOUBLE_BOOKING_MESSAGE }, { status: 400 });
      }
      throw e;
    }

    // Atomically reserve slot(s) BEFORE creating Stripe checkout.
    const slotsToReserve = sessionPayloads.map((p) => ({
      providerId,
      startTime: String(p.scheduledStart || ''),
      endTime: String(p.scheduledEnd || ''),
    }));

    const reserveResult = await reserveSlotsAtomically(slotsToReserve);
    if (!reserveResult.ok) {
      // Retry recovery: if the slot is "reserved" by this user's in-flight checkout, reuse it.
      if (existingCheckoutSessionId) {
        try {
          const prev = await stripe.checkout.sessions.retrieve(existingCheckoutSessionId);
          const prevStatus = typeof prev?.status === 'string' ? prev.status : '';
          const prevPaid = prev?.payment_status === 'paid' || prevStatus === 'complete';
          if (!prevPaid && prev?.url) {
            console.log('[CHECKOUT_RETRY_RECOVERED]', {
              providerId,
              startTime: firstSlotStartTime,
              reusedSessionId: null,
              reusedCheckoutSessionId: prev.id,
              bookingId: (existingBooking as any)?.id,
            });
            return NextResponse.json({ sessionId: prev.id, url: prev.url });
          }
        } catch {}
      }

      return NextResponse.json(
        { error: 'This time slot was just booked by someone else. Please pick another time.' },
        { status: 409 }
      );
    }

    const single = sessionPayloads[0] as any;

    // Store bundle session times server-side (Stripe metadata is too small for JSON blobs).
    // This is referenced by `client_reference_id` and read by the Stripe webhook when creating sessions.
    const checkoutBookingId = crypto.randomUUID();
    await writeCheckoutBookingRecord({
      id: checkoutBookingId,
      createdAt: new Date().toISOString(),
      idempotencyKey,
      studentId,
      providerId,
      serviceType: normalizedServiceType,
      plan: pricingPlan,
      sessionTimes: sessionPayloads.map((p: any) => ({
        scheduledStart: String(p?.scheduledStart || ''),
        scheduledEnd: String(p?.scheduledEnd || ''),
      })),
      subject: normalizedAvailabilityServiceType === 'tutoring' || normalizedAvailabilityServiceType === 'test_prep' ? (subject || null) : null,
      topic: normalizedAvailabilityServiceType === 'tutoring' || normalizedAvailabilityServiceType === 'test_prep' ? (topic || null) : null,
      schoolId: normalizedAvailabilityServiceType === 'college_counseling' ? (schoolId || null) : null,
      schoolName: normalizedAvailabilityServiceType === 'college_counseling' ? (schoolName || null) : null,
    });
    const sessionTimesForMetadata = sessionPayloads.map((p: any) => ({
      scheduledStart: String(p?.scheduledStart || ''),
      scheduledEnd: String(p?.scheduledEnd || ''),
    }));
    const sessionsJson = JSON.stringify(sessionTimesForMetadata);
    // Compact, parseable fallback (useful when JSON is too large for Stripe metadata limits)
    const sessionsPacked = sessionTimesForMetadata
      .map((t) => `${t.scheduledStart},${t.scheduledEnd}`)
      .join(';');

    // Create Stripe Checkout Session (Stripe must charge EXACTLY purchase_price_cents)
    // Stripe Checkout automatically enables Apple Pay, Google Pay, and other payment methods
    // when available based on customer location and device capabilities
    let checkoutSession: Stripe.Checkout.Session;
    try {
      // Validate the Stripe price exists BEFORE creating checkout session.
      // This prevents confusing "No such price" failures later and helps ensure live env
      // isn't accidentally using stale/test price IDs.
      try {
        const price = await stripe.prices.retrieve(stripePriceId);
        if (stripeDebug) {
          console.log('CHECKOUT stripe price livemode:', price.livemode);
          console.log('CHECKOUT stripe price active:', price.active);
        }
        if (price.active === false) {
          throw new Error(`Stripe price is inactive: ${stripePriceId}`);
        }
        if (process.env.NODE_ENV === 'production' && price.livemode !== true) {
          throw new Error(`Stripe price is not live-mode in production: ${stripePriceId}`);
        }
      } catch (e) {
        console.error('CHECKOUT Stripe price validation failed:', e);
        await unreserveSlotsAtomically(slotsToReserve);
        // Best-effort cleanup of server-side booking record
        try {
          await deleteCheckoutBookingRecord(checkoutBookingId);
        } catch {}
        return NextResponse.json(
          { success: false, message: 'Payments are temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }

      try {
        if (stripeDebug) {
          console.log('CHECKOUT about to create Stripe session:', {
            stripePriceId,
            providerId,
            sessionDate,
            sessionTime,
            baseUrl,
            successUrl: `${baseUrl}/dashboard/book/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${baseUrl}/dashboard/book/summary?canceled=true`,
          });
        }
        checkoutSession = await stripe.checkout.sessions.create(
          {
          payment_method_types: ['card'], // Cards are always enabled
          // Apple Pay, Google Pay, Cash App, Affirm, Klarna, Link, etc. are automatically
          // enabled by Stripe Checkout when available for the customer
          // Taxes: Stripe Tax calculates tax based on the customer's address and product tax category.
          // IMPORTANT: This must add tax ON TOP of the listed service price (prices must be tax_behavior='exclusive').
      
          // Collect billing address so Stripe Tax can determine jurisdiction.
          
          // Optional: allow customers with tax IDs (e.g. VAT/GST) to provide them.
          tax_id_collection: { enabled: true },
          allow_promotion_codes: true,
          line_items: [{ price: stripePriceId, quantity: 1 }],
          mode: 'payment',
          // IMPORTANT: Do NOT pass both `customer` and `customer_email`.
          // Always use email to avoid creation failures and let Stripe associate receipts.
          customer_email: user.email,
          success_url: `${baseUrl}/dashboard/book/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/dashboard/book/summary?canceled=true`,
          client_reference_id: `ivyway|${normalizedServiceType}|${studentId}|${providerId}|${String(single?.scheduledStart || '')}|${String(single?.scheduledEnd || '')}|${checkoutBookingId}`.slice(0, 500),
          metadata: {
            // Keep Stripe metadata minimal; webhook primarily uses client_reference_id + checkout store.
            serviceType: normalizedServiceType,
            service_type: normalizedServiceType,
            studentId,
            providerId,
            checkoutBookingId,
            idempotencyKey: String(idempotencyKey || '').slice(0, 500),
            // Fallback for serverless runtimes where repo filesystem is read-only (e.g. Vercel):
            // webhook + /api/checkout-session can reconstruct bundle session times from metadata if needed.
            sessionsJson: sessionsJson.length <= 500 ? sessionsJson : '',
            sessionsPacked: sessionsPacked.length <= 500 ? sessionsPacked : '',
            // Helpful context (size-limited; canonical persistence is in checkout store above)
            subject: (subject ? subject.slice(0, 250) : ''),
            topic: (topic ? topic.slice(0, 250) : ''),
          },
          // Enable 3D Secure for cards
          payment_method_options: {
            card: {
              request_three_d_secure: 'automatic',
            },
          },
          },
          { idempotencyKey }
        );

        // Link the server-side booking record to the Stripe session id (for diagnostics + support tooling).
        try {
          await setCheckoutBookingCheckoutSessionId(checkoutBookingId, checkoutSession.id);
        } catch (e) {
          console.warn('[CHECKOUT] Failed to attach checkout_session_id to booking record (non-blocking)', e);
        }
      } catch (error) {
        console.error('[CHECKOUT ERROR]', {
          message: error instanceof Error ? error.message : String(error),
          pricingKey,
          stripePriceId,
          providerId,
          sessionDate,
          sessionTime,
          baseUrl,
          stripe: {
            type: (error as any)?.type,
            code: (error as any)?.code,
            statusCode: (error as any)?.statusCode,
            requestId: (error as any)?.requestId,
            raw: (error as any)?.raw,
          },
        });
        console.error("[CHECKOUT ERROR FULL]", error);

        // Stripe checkout creation failed; roll back reservation so the slot reappears
        await unreserveSlotsAtomically(slotsToReserve);
        // Best-effort cleanup of server-side booking record
        try {
          await deleteCheckoutBookingRecord(checkoutBookingId);
        } catch {}

        return NextResponse.json(
          {
            success: false,
            message:
              process.env.NODE_ENV === 'production'
                ? 'Unable to start checkout. Please try again.'
                : (error instanceof Error ? error.message : String(error)),
          },
          { status: 502 }
        );
      }
    } catch (error) {
      // Non-Stripe errors in the checkout creation block
      await unreserveSlotsAtomically(slotsToReserve);
      // Best-effort cleanup of server-side booking record
      try {
        await deleteCheckoutBookingRecord(checkoutBookingId);
      } catch {}
      throw error;
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    return handleApiError(error, {
      logPrefix: '[api/checkout]',
      status: 503,
      publicMessage: 'Unable to start checkout. Please try again.',
    });
  }
}
