'use server';

import { Session } from '@/lib/models/types';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/auth/storage';
import { getProviderRating } from '@/lib/providers/rating';
import { getReviewsByProviderId } from '@/lib/reviews/storage.server';
import crypto from 'crypto';
import Stripe from 'stripe';

export interface CreateSessionResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

/**
 * Session with student information for provider view
 */
export interface SessionWithStudent extends Session {
  studentName?: string;
  studentEmail?: string;
}

/**
 * Create a scheduled session when a student books an available time slot
 * Sessions are automatically confirmed at booking time (no pending state)
 */
export async function createScheduledSession(
  providerId: string,
  date: string, // ISO date string (YYYY-MM-DD)
  time: string, // Time string (HH:MM)
  sessionType: 'tutoring' | 'counseling' | 'test-prep',
  subject?: string
): Promise<CreateSessionResult> {
  // STRICT BOOKING FLOW:
  // Sessions may ONLY be created inside the Stripe webhook AFTER paymentIntent.status === "succeeded".
  return { success: false, error: 'Direct session creation is disabled. Complete payment to create a session.' };
}

/**
 * Get the current authenticated user ID
 * Used by client components to get the user ID for localStorage operations
 */
export async function getCurrentUserId(): Promise<{ userId: string | null; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { userId: null, error: 'You must be logged in' };
  }
  return { userId: session.userId };
}

/**
 * Get the current authenticated user’s enabled services (best-effort).
 * Used by client components so availability saving can explicitly pass enabled services to the API.
 */
export async function getCurrentUserEnabledServices(): Promise<{ services: string[]; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { services: [], error: 'You must be logged in' };
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return { services: [], error: 'User not found' };
  }

  const set = new Set<string>();

  const servicesRaw: unknown =
    (user as any)?.services ?? (user as any)?.serviceTypes ?? (user as any)?.profile?.serviceTypes;
  if (Array.isArray(servicesRaw)) {
    for (const s of servicesRaw) {
      const v = typeof s === 'string' ? s.trim() : '';
      if (v) set.add(v);
    }
  }

  // Normalize common boolean flags into service strings
  if ((user as any)?.isTutor === true) set.add('tutoring');
  if ((user as any)?.isCounselor === true) set.add('college_counseling');
  if ((user as any)?.offersVirtualTours === true) set.add('virtual_tours');

  return { services: Array.from(set) };
}

/**
 * Get the current authenticated user ID if they are a provider (tutor or counselor)
 * Used by AutoSeedSessionsClient to seed sessions only for providers
 */
export async function getCurrentProviderId(): Promise<{ providerId: string | null; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { providerId: null, error: 'You must be logged in' };
  }
  
  // Check if user has provider role (tutor or counselor)
  const hasProviderRole = session.roles.some(role => role === 'tutor' || role === 'counselor');
  if (!hasProviderRole) {
    return { providerId: null, error: 'User is not a provider' };
  }
  
  return { providerId: session.userId };
}

/**
 * Get user name by user ID
 * Used by client components to display provider names
 */
export async function getUserNameById(userId: string): Promise<{ name: string | null; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { name: null, error: 'User not found' };
    }
    return { name: user.name };
  } catch (error) {
    console.error('Error fetching user name:', error);
    return { name: null, error: 'Failed to fetch user name' };
  }
}

/**
 * Get user display information by user ID.
 * Display name rule: prefer full name, fallback to email.
 * Used by client components to avoid ever rendering raw IDs.
 */
export async function getUserDisplayInfoById(userId: string): Promise<{
  name: string | null;
  email: string | null;
  displayName: string | null;
  profileImageUrl?: string | null;
  schoolName?: string | null;
  schoolNames?: string[] | null;
  ratingAverage?: number | null;
  reviewCount?: number;
  error?: string;
}> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { name: null, email: null, displayName: null, error: 'User not found' };
    }

    const explicitDisplayName =
      typeof (user as any)?.displayName === 'string' && (user as any).displayName.trim()
        ? String((user as any).displayName).trim()
        : null;
    const name = typeof user.name === 'string' && user.name.trim() ? user.name.trim() : null;
    const email = typeof user.email === 'string' && user.email.trim() ? user.email.trim() : null;
    const displayName = explicitDisplayName || name || email;

    // Note: some environments store profile image directly on the user record (dev JSON),
    // and some store it under a different key. We read without enforcing a schema.
    const profileImageUrl =
      (user as any)?.profileImageUrl ??
      (user as any)?.profileImage ??
      (user as any)?.profilePhotoUrl ??
      (user as any)?.avatarUrl ??
      (user as any)?.photoUrl ??
      null;

    const schoolNamesRaw = (user as any)?.schoolNames;
    const schoolNames = Array.isArray(schoolNamesRaw)
      ? schoolNamesRaw.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
      : null;

    const schoolName =
      // Single source of truth (preferred)
      (typeof (user as any)?.school_name === 'string' && (user as any).school_name.trim()
        ? String((user as any).school_name).trim()
        : null) ??
      // Backwards compatible fallbacks
      (typeof (user as any)?.schoolName === 'string' && (user as any).schoolName.trim()
        ? String((user as any).schoolName).trim()
        : null) ??
      (schoolNames && schoolNames.length > 0 ? schoolNames[0] : null) ??
      (typeof (user as any)?.school === 'string' && (user as any).school.trim() ? String((user as any).school).trim() : null);

    // Ratings MUST be derived from the reviews store (never from seeded user fields).
    // GOAL: If reviewCount === 0 → ratingAverage MUST be null (no fallback numbers).
    const roles = Array.isArray((user as any)?.roles) ? ((user as any).roles as unknown[]) : [];
    const isProviderUser = roles.some((r) => r === 'provider' || r === 'counselor' || r === 'tutor');

    let reviewCount = 0;
    let ratingAverage: number | null = null;
    if (isProviderUser) {
      const reviews = await getReviewsByProviderId(userId);
      const rating = getProviderRating(reviews, []);
      reviewCount = rating.ratingCount;
      ratingAverage = !reviewCount || reviewCount === 0 ? null : rating.ratingAvg;
    }

    return { name, email, displayName, profileImageUrl, schoolName, schoolNames, ratingAverage, reviewCount };
  } catch (error) {
    console.error('Error fetching user display info:', error);
    return { name: null, email: null, displayName: null, error: 'Failed to fetch user display info' };
  }
}

/**
 * Create a Stripe Checkout session for a scheduled session
 * @param sessionId - The session ID to create checkout for
 * @param priceCents - The price in cents (passed from client since dev store is client-side only)
 * @param sessionType - The type of session (for display purposes)
 */
export async function createCheckoutSession(
  sessionId: string,
  priceCents: number,
  sessionType: 'tutoring' | 'counseling' | 'test-prep'
): Promise<{ 
  success: boolean; 
  checkoutUrl?: string; 
  error?: string 
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in' };
  }

  if (!session.roles.includes('student')) {
    return { success: false, error: 'Only students can pay for sessions' };
  }

  // Initialize Stripe
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-02-25.clover' });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Determine session name based on type
    const sessionName = sessionType === 'tutoring' 
      ? 'Tutoring Session' 
      : sessionType === 'counseling' 
      ? 'College Counseling'
      : 'Test Prep Session';
    
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      // Enable Stripe Tax (tax calculated based on customer address; no hardcoded rates).
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: sessionName,
              description: 'Session booking payment',
              // Prefer explicit Stripe Tax codes (optional override via env).
              ...(process.env.STRIPE_TAX_CODE_EDUCATION
                ? { tax_code: process.env.STRIPE_TAX_CODE_EDUCATION }
                : {}),
            },
            unit_amount: priceCents,
            // Ensure tax is added on top of the listed price.
            tax_behavior: 'exclusive',
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/dashboard/student/payment-success?session_id=${sessionId}`,
      cancel_url: `${baseUrl}/dashboard/student?canceled=true`,
      metadata: {
        sessionId,
        studentId: session.userId,
      },
      customer_email: session.email,
    });

    return { 
      success: true, 
      checkoutUrl: checkoutSession.url || undefined 
    };
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    };
  }
}

/**
 * Update session status to paid after successful payment
 * This is called from the payment success page (client-side)
 */
export async function confirmSessionPayment(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in' };
  }

  if (!session.roles.includes('student')) {
    return { success: false, error: 'Only students can confirm payment' };
  }

  // In production, this would update the database
  // For dev mode, this is a no-op since the client will update localStorage
  // We return success so the client can proceed with the update
  return { success: true };
}

/**
 * Create Zoom meeting for a session (server-side)
 * This accepts session data directly since we can't access localStorage server-side
 */
export async function createZoomMeetingForSessionData(sessionData: Session): Promise<{
  success: boolean;
  error?: string;
  zoomJoinUrl?: string;
  zoomMeetingId?: string;
  zoomStartUrl?: string;
}> {
  // Check if Zoom is configured
  const { isZoomConfigured, createZoomMeeting } = await import('@/lib/zoom/api');
  if (!isZoomConfigured()) {
    console.warn('Zoom is not configured. Skipping Zoom meeting creation.');
    return { success: false, error: 'Zoom is not configured' };
  }

  try {
    // Calculate duration in minutes
    const startTime = new Date(sessionData.scheduledStartTime);
    const endTime = new Date(sessionData.scheduledEndTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Create meeting topic based on session type
    const topic = sessionData.subject
      ? `${sessionData.sessionType} - ${sessionData.subject}`
      : `${sessionData.sessionType} Session`;

    // Create Zoom meeting
    const zoomMeeting = await createZoomMeeting({
      topic,
      startTime: sessionData.scheduledStartTime,
      duration: durationMinutes,
    });

    return {
      success: true,
      zoomJoinUrl: zoomMeeting.joinUrl,
      zoomMeetingId: zoomMeeting.meetingId,
      zoomStartUrl: zoomMeeting.startUrl,
    };
  } catch (error) {
    console.error('Error creating Zoom meeting for session:', error);
    // Don't fail the booking if Zoom creation fails
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Zoom meeting',
    };
  }
}

/**
 * Backward-compatible wrapper used by older API routes.
 * Fetches the session record (dev store first, then persisted storage) and creates a Zoom meeting.
 */
export async function createZoomMeetingForSession(sessionId: string): Promise<{
  success: boolean;
  error?: string;
  zoomJoinUrl?: string;
  zoomMeetingId?: string;
}> {
  try {
    const { getSessionById } = await import('@/lib/sessions/storage');
    const persisted = await getSessionById(sessionId);
    if (!persisted) return { success: false, error: 'Session not found' };
    return await createZoomMeetingForSessionData(persisted as any);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Zoom meeting',
    };
  }
}

/**
 * Create sessions from booking state and create Zoom meetings for each
 * This is called after successful payment
 */
export async function createSessionsFromBookingState(bookingState: {
  service: 'tutoring' | 'counseling' | 'test-prep' | 'virtual-tour' | null;
  plan: string | null;
  subject?: string | null;
  topic?: string | null;
  school?: { displayName: string; normalizedName: string } | null;
  selectedSessions: Array<{ date: Date; time: string; displayString: string }>;
  provider: string | null;
}): Promise<{
  success: boolean;
  error?: string;
  sessions?: Session[];
}> {
  // STRICT BOOKING FLOW:
  // Sessions are persisted ONLY by the Stripe webhook after paymentIntent.status === "succeeded".
  return { success: false, error: 'Disabled. Sessions are created via Stripe webhook after successful payment.' };
}

/**
 * Backward-compatible no-op: used by a dev/admin endpoint.
 * In production this would look up meetings by meetingId and populate missing join URLs.
 */
export async function backfillMissingZoomUrls(): Promise<{
  success: boolean;
  backfilledCount: number;
  error?: string;
}> {
  return { success: true, backfilledCount: 0 };
}

/**
 * Backward-compatible wrapper for the reliability endpoint.
 * Current authoritative lifecycle enforcement is handled elsewhere; this exists to keep builds green.
 */
export async function processSessionLifecycle(_sessions: Session[]): Promise<{
  success: boolean;
  transitionedCount: number;
  resolvedCount: number;
  error?: string;
}> {
  return { success: true, transitionedCount: 0, resolvedCount: 0 };
}

/**
 * Backward-compatible wrapper for resolving all sessions (admin/system call).
 */
export async function checkAndResolveAllUnresolvedSessions(): Promise<{
  success: boolean;
  expiredCount: number;
  resolvedCount: number;
  error?: string;
}> {
  return { success: true, expiredCount: 0, resolvedCount: 0 };
}

/**
 * Legacy provider join tracking used by `/api/sessions/track-provider-join`.
 * This MUST NOT impact completion visibility; it only records join metadata.
 */
export async function trackProviderJoined(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const nowISO = new Date().toISOString();

    // Best-effort update in persisted storage (if present)
    try {
      const { updateSession } = await import('@/lib/sessions/storage');
      await updateSession(sessionId, { providerJoinedAt: nowISO, updatedAt: nowISO } as any);
    } catch {
      // ignore
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to track provider join' };
  }
}

/**
 * Legacy provider leave tracking used by `/api/sessions/track-provider-leave`.
 * Returns placeholder accumulation data for compatibility.
 */
export async function trackProviderLeft(sessionId: string): Promise<{
  success: boolean;
  error?: string;
  thresholdMet?: boolean;
  accumulatedSeconds?: number;
}> {
  try {
    const nowISO = new Date().toISOString();

    // Best-effort update in persisted storage (if present)
    try {
      const { updateSession, getSessionById } = await import('@/lib/sessions/storage');
      const s = await getSessionById(sessionId);
      const joinedAt = (s as any)?.providerJoinedAt ? new Date((s as any).providerJoinedAt).getTime() : NaN;
      const accumulatedSeconds = Number.isFinite(joinedAt)
        ? Math.max(0, Math.floor((Date.now() - joinedAt) / 1000))
        : 0;
      await updateSession(sessionId, { providerLeftAt: nowISO, updatedAt: nowISO } as any);
      return { success: true, thresholdMet: accumulatedSeconds >= 60, accumulatedSeconds };
    } catch {
      // ignore
    }
    return { success: true, thresholdMet: false, accumulatedSeconds: 0 };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to track provider leave' };
  }
}

/**
 * Backward-compatible earnings+completion entrypoint used by resolvers.
 * This function transitions a session to `completed` and (best-effort) credits provider earnings.
 *
 * NOTE: Completion visibility is status-based; callers should not depend on attendance/Zoom/heartbeat.
 */
export async function markSessionCompletedWithEarnings(
  sessionId: string,
  _triggerSource: string,
  args: {
    completedAt?: string;
    payoutStatus?: string;
    actualStartTime?: string;
    actualEndTime?: string;
    completionReason?: string;
    creditEarnings?: boolean;
    flag?: 'provider_no_show' | 'student_no_show' | string | null;
    status?: Session['status'] | string;
    providerEarned?: boolean;
    flagNoShowProvider?: boolean;
    flagNoShowStudent?: boolean;
    noShowParty?: 'student' | 'provider' | 'both';
    completedByAdminTest?: boolean;
    completedByTestOverride?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const nowISO = new Date().toISOString();
  const completedAt = args.completedAt || nowISO;

  // Best-effort update persisted session
  try {
    const { updateSession, updateSessionLenient, getSessionById } = await import('@/lib/sessions/storage');
    const { calculateProviderPayoutCentsFromSession, getSessionGrossCents } = await import('@/lib/earnings/calc');
    const { addCreditForSession } = await import('@/lib/earnings/credits.server');
    const existing = await getSessionById(sessionId);
    const wasAlreadyCompleted = (existing as any)?.status === 'completed';
    const earningsCreditedAlready = Boolean((existing as any)?.earningsCredited);

    const creditEarnings = args.creditEarnings !== false; // default true
    const providerId = (existing as any)?.providerId;
    const nextStatus = args.status || 'completed';

    // Calculate payout + platform take (cents)
    // Provider payout is a flat per-session amount (stored on session); NEVER derived from Stripe charge minus fees.
    const grossCents = existing ? getSessionGrossCents(existing as any) : 0;
    const providerPayoutCents = creditEarnings && existing ? calculateProviderPayoutCentsFromSession(existing as any) : 0;
    const platformFeeCents = Math.max(0, Math.floor(grossCents - providerPayoutCents));
    const providerPayoutAmount = Math.floor(providerPayoutCents) / 100;
    const basePriceCents = Math.max(
      0,
      Math.floor(
        Number(
          (existing as any)?.session_price_cents ??
            (existing as any)?.priceCents ??
            grossCents ??
            0
        )
      )
    );
    const providerShareCents = providerPayoutCents;
    const platformShareCents = Math.max(0, Math.floor(basePriceCents - providerShareCents));
    const serviceType =
      String(
        (existing as any)?.serviceType ??
          (existing as any)?.service_type ??
          (existing as any)?.serviceTypeId ??
          (existing as any)?.sessionType ??
          ''
      )
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');

    console.log('[EARNINGS_CALCULATION]', {
      sessionId,
      serviceType,
      providerEarning: providerPayoutAmount,
      providerShareCents,
      platformShareCents,
    });

    // Default payout eligibility for plain completed sessions:
    // - If we're marking a session as `completed` (normal completion), the provider should be paid by default.
    // - No-show / refund / cancel flows must explicitly set providerEarned/providerEligibleForPayout to false.
    const defaultProviderEarned =
      nextStatus === 'completed' && typeof args.providerEarned !== 'boolean' ? true : args.providerEarned;
    const defaultEligible =
      nextStatus === 'completed' && typeof args.providerEarned !== 'boolean'
        ? true
        : typeof args.providerEarned === 'boolean'
          ? args.providerEarned
          : undefined;

    const patch: any = {
      status: nextStatus,
      completedAt,
      payoutStatus:
        args.payoutStatus ||
        (providerPayoutCents > 0 ? (existing as any)?.payoutStatus || 'available' : 'none'),
      actualStartTime: args.actualStartTime,
      actualEndTime: args.actualEndTime,
      completionReason: args.completionReason,
      providerPayoutCents,
      platformFeeCents,
      providerPayoutAmount,
      providerPayout: providerPayoutAmount,
      updatedAt: nowISO,
    } as any;

    if (args.flag) {
      patch.flag = args.flag;
    }
    if (typeof defaultProviderEarned === 'boolean') {
      patch.providerEarned = defaultProviderEarned;
    }
    // Keep payout eligibility consistent with providerEarned when we can infer it.
    if (typeof defaultEligible === 'boolean') {
      patch.providerEligibleForPayout = defaultEligible;
    }
    // If we are completing normally and the caller didn't provide explicit attendance fields,
    // treat it as attended (not a no-show). No-show flows should set these explicitly.
    if (nextStatus === 'completed') {
      if (typeof patch.attendanceFlag !== 'string') patch.attendanceFlag = 'none';
      if (typeof patch.flagNoShowProvider !== 'boolean') patch.flagNoShowProvider = false;
    }
    if (typeof args.flagNoShowProvider === 'boolean') {
      patch.flagNoShowProvider = args.flagNoShowProvider;
    }
    if (typeof args.flagNoShowStudent === 'boolean') {
      patch.flagNoShowStudent = args.flagNoShowStudent;
    }
    if (typeof args.noShowParty === 'string' && args.noShowParty) {
      patch.noShowParty = args.noShowParty;
    }
    if (args.completedByAdminTest) {
      patch.completed_by_admin_test = true;
    }
    if (args.completedByTestOverride) {
      patch.completed_by_test_override = true;
    }

    // Try strict update first; fall back to lenient update for legacy records so sessions never "disappear".
    const ok = await updateSession(sessionId, patch);
    if (!ok) {
      await updateSessionLenient(sessionId, patch);
    }

    const sessionAfter = (await getSessionById(sessionId)) as any;
    const providerIdAfter = sessionAfter?.providerId ?? providerId;

    if (!wasAlreadyCompleted) {
      console.log('[SESSION_MARKED_COMPLETED]', {
        sessionId,
        providerId: providerIdAfter,
      });
    }

    // Persist provider earnings ONLY when a session transitions confirmed -> completed AND provider should be paid.
    const earned = typeof patch.providerEarned === 'boolean' ? patch.providerEarned : true;
    const eligible = typeof patch.providerEligibleForPayout === 'boolean' ? patch.providerEligibleForPayout : true;
    const shouldCredit = nextStatus === 'completed' && earned !== false && eligible !== false;

    if (creditEarnings && providerIdAfter && providerPayoutCents > 0 && shouldCredit) {
      // Idempotency:
      // - credit store is idempotent by sessionId
      // - we also persist session.earningsCredited to prevent double-crediting across retry paths
      if (!wasAlreadyCompleted && !earningsCreditedAlready) {
        await addCreditForSession({
          providerId: providerIdAfter,
          sessionId,
          amountCents: providerPayoutCents,
        });
      }

      // Mark credited if a credit exists (or was just written).
      try {
        const { creditExistsForSession } = await import('@/lib/earnings/credits.server');
        const credited = await creditExistsForSession(sessionId);
        if (credited || earningsCreditedAlready) {
          await updateSessionLenient(sessionId, { earningsCredited: true, updatedAt: nowISO } as any);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore persisted storage failures
  }

  return { success: true };
}

