import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { getAuthContext } from '@/lib/auth/session';
import { getUserById, getUsers } from '@/lib/auth/storage';
import { reserveSlotsAtomically, unreserveSlotsAtomically } from '@/lib/availability/store.server';
import { getSessions } from '@/lib/sessions/storage';
import { SCHOOLS } from '@/data/schools';
import { getSessionPricingCents, ServiceType as PricingServiceType, Plan as PricingPlan } from '@/lib/pricing/catalog';
import { getStripePriceIdForPricingKey } from '@/lib/pricing/stripePriceIds';
import { deleteCheckoutBookingRecord, writeCheckoutBookingRecord } from '@/lib/stripe/checkoutBookingStore.server';

// Initialize Stripe with secret key from environment variable
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Missing user email for checkout' }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const bookingState = body?.bookingState;

    // Get base URL for redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (request.headers.get('origin') || 'http://localhost:3000');

    // Build booking metadata for webhook session creation
    // NOTE: Stripe metadata values must be strings and have size limits.
    const studentId = session.userId;
    const providerIdRaw = (bookingState?.provider as string | undefined) || '';
    let providerId = providerIdRaw.trim();
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
    const normalizedService = String(serviceRaw || '').trim().toLowerCase().replace(/-/g, '_');
    const canonicalServiceType: PricingServiceType | null =
      normalizedService === 'tutoring'
        ? 'tutoring'
        : normalizedService === 'college_counseling' || normalizedService === 'counseling'
          ? 'counseling'
          : normalizedService === 'virtual_tour' || normalizedService === 'virtual_tours'
            ? 'virtual_tour'
            : normalizedService === 'test_prep' || normalizedService === 'testprep'
              ? 'test_prep'
              : null;

    if (!canonicalServiceType) {
      return NextResponse.json(
        { error: 'Unsupported service type for booking' },
        { status: 400 }
      );
    }

    const subject = String(subjectRaw || '').trim();
    const topic = String(topicRaw || '').trim();
    let schoolId = String(schoolIdRaw || '').trim();
    let schoolName = String(schoolNameRaw || '').trim();

    // SAFETY: Prevent bypass for virtual tours — must not allow booking attempts for schools with 0 providers.
    if (canonicalServiceType === 'virtual_tour') {
      if (!schoolId) {
        return NextResponse.json({ error: 'School ID is required for virtual tours' }, { status: 400 });
      }

      const users = await getUsers();
      const eligibleProviders = users
        .filter((u: any) => Array.isArray(u?.roles) && (u.roles.includes('provider') || u.roles.includes('counselor')))
        .filter((u: any) => {
          const services = Array.isArray(u?.services) ? u.services.map((s: any) => String(s || '').trim().toLowerCase()) : [];
          return u?.offersVirtualTours === true || services.includes('virtual_tour') || services.includes('virtual_tours');
        })
        .filter((u: any) => {
          const primary = String(u?.school_id || u?.schoolId || '').trim();
          if (primary && primary === schoolId) return true;
          const ids = Array.isArray(u?.schoolIds) ? u.schoolIds.map((id: any) => String(id || '').trim()) : [];
          return ids.includes(schoolId);
        });

      if (eligibleProviders.length === 0) {
        return NextResponse.json({ error: 'No providers available for this school' }, { status: 400 });
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
    const duration_minutes: 60 | null = canonicalServiceType === 'counseling' ? 60 : null;

    const pricing = getSessionPricingCents({
      service_type: canonicalServiceType,
      plan: pricingPlan,
      duration_minutes,
    });

    const stripePriceId = getStripePriceIdForPricingKey(pricing.pricing_key);

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
          serviceType: canonicalServiceType,
          subject: canonicalServiceType === 'tutoring' || canonicalServiceType === 'test_prep' ? subject : '',
          school: canonicalServiceType === 'counseling' ? schoolName : '',
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
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    if (!(await isValidProviderUserId(providerId))) {
      return NextResponse.json(
        { error: 'Invalid providerId (must be a real provider user id)' },
        { status: 400 }
      );
    }

    if (sessionPayloads.length === 0) {
      return NextResponse.json(
        { error: 'At least one session time is required' },
        { status: 400 }
      );
    }

    // Enforce all selected sessions are for the same providerId (booking integrity)
    for (const p of sessionPayloads) {
      if (p.providerId !== providerId) {
        return NextResponse.json(
          { error: 'All selected sessions must use the same providerId' },
          { status: 400 }
        );
      }
    }

    // Prevent duplicate bookings (existing session already created)
    const existing = await getSessions();
    const isActive = (status: any) => typeof status === 'string' && !status.startsWith('cancelled');
    const hasExistingSession = sessionPayloads.some((p) => {
      const scheduledStart = String(p.scheduledStart || '');
      const scheduledEnd = String(p.scheduledEnd || '');
      return existing.some((s: any) => {
        const sStart = s?.scheduledStartTime || s?.scheduledStart;
        const sEnd = s?.scheduledEndTime || s?.scheduledEnd;
        return (
          s?.providerId === providerId &&
          sStart === scheduledStart &&
          sEnd === scheduledEnd &&
          isActive(s?.status)
        );
      });
    });

    if (hasExistingSession) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 409 }
      );
    }

    // Atomically reserve slot(s) BEFORE creating Stripe checkout.
    const slotsToReserve = sessionPayloads.map((p) => ({
      providerId,
      startTime: String(p.scheduledStart || ''),
      endTime: String(p.scheduledEnd || ''),
    }));

    const reserveResult = await reserveSlotsAtomically(slotsToReserve);
    if (!reserveResult.ok) {
      return NextResponse.json(
        { error: 'This time slot was just booked by someone else. Please pick another time.' },
        { status: 409 }
      );
    }

    // Check if Stripe is configured
    if (!stripe) {
      // Roll back reservation (cannot proceed to payment)
      await unreserveSlotsAtomically(slotsToReserve);
      console.warn('Stripe API key not configured. Returning mock checkout URL.');
      return NextResponse.json({
        sessionId: 'mock_session_' + Date.now(),
        url: null,
        mock: true,
      });
    }

    const single = sessionPayloads[0] as any;

    // Store bundle session times server-side (Stripe metadata is too small for JSON blobs).
    // This is referenced by `client_reference_id` and read by the Stripe webhook when creating sessions.
    const checkoutBookingId = crypto.randomUUID();
    await writeCheckoutBookingRecord({
      id: checkoutBookingId,
      createdAt: new Date().toISOString(),
      studentId,
      providerId,
      serviceType: canonicalServiceType,
      plan: pricingPlan,
      sessionTimes: sessionPayloads.map((p: any) => ({
        scheduledStart: String(p?.scheduledStart || ''),
        scheduledEnd: String(p?.scheduledEnd || ''),
      })),
      subject: canonicalServiceType === 'tutoring' || canonicalServiceType === 'test_prep' ? (subject || null) : null,
      topic: canonicalServiceType === 'tutoring' || canonicalServiceType === 'test_prep' ? (topic || null) : null,
      schoolId: canonicalServiceType === 'counseling' || canonicalServiceType === 'virtual_tour' ? (schoolId || null) : null,
      schoolName: canonicalServiceType === 'counseling' || canonicalServiceType === 'virtual_tour' ? (schoolName || null) : null,
    });

    // Create Stripe Checkout Session (Stripe must charge EXACTLY purchase_price_cents)
    // Stripe Checkout automatically enables Apple Pay, Google Pay, and other payment methods
    // when available based on customer location and device capabilities
    let checkoutSession: Stripe.Checkout.Session;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Cards are always enabled
      // Apple Pay, Google Pay, Cash App, Affirm, Klarna, Link, etc. are automatically
      // enabled by Stripe Checkout when available for the customer
      // Taxes: Stripe Tax calculates tax based on the customer's address and product tax category.
      // IMPORTANT: This must add tax ON TOP of the listed service price (prices must be tax_behavior='exclusive').
      automatic_tax: { enabled: true },
      // Collect billing address so Stripe Tax can determine jurisdiction.
      billing_address_collection: 'required',
      // Optional: allow customers with tax IDs (e.g. VAT/GST) to provide them.
      tax_id_collection: { enabled: true },
      allow_promotion_codes: false,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: 'payment',
      // IMPORTANT: Do NOT pass both `customer` and `customer_email`.
      // Always use email to avoid creation failures and let Stripe associate receipts.
      customer_email: user.email,
      success_url: `${baseUrl}/dashboard/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/book/summary?canceled=true`,
      client_reference_id: `ivyway|${canonicalServiceType}|${studentId}|${providerId}|${String(single?.scheduledStart || '')}|${String(single?.scheduledEnd || '')}|${checkoutBookingId}`.slice(0, 500),
      metadata: {
        // Keep Stripe metadata minimal; webhook primarily uses client_reference_id + checkout store.
        serviceType: canonicalServiceType,
        checkoutBookingId,
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
      });
    } catch (err) {
      // Stripe checkout creation failed; roll back reservation so the slot reappears
      await unreserveSlotsAtomically(slotsToReserve);
      // Best-effort cleanup of server-side booking record
      try {
        await deleteCheckoutBookingRecord(checkoutBookingId);
      } catch {}
      throw err;
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating Stripe Checkout Session:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
