import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthContext } from '@/lib/auth/session';
import { getUserById } from '@/lib/auth/storage';
import { reserveSlotsAtomically, unreserveSlotsAtomically } from '@/lib/availability/store.server';
import { createSession, updateSession } from '@/lib/sessions/storage';
import { getSessionPricingCents } from '@/lib/pricing/catalog';
import { consumeOneCounselingMonthlyCredit, getCounselingMonthlyCreditsRemaining } from '@/lib/credits/counselingCredits.server';
import { createZoomMeeting, isZoomConfigured } from '@/lib/zoom/api';
import { getProviderPayout } from '@/lib/payouts/getProviderPayout';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { sendBookingConfirmationEmailsForSession } from '@/lib/email/transactional';
import { assertNoStudentDoubleBooking, DOUBLE_BOOKING_MESSAGE, DoubleBookingError } from '@/lib/sessions/doubleBooking.server';

/**
 * POST /api/counseling/book-with-credit
 * Books a single 60-minute counseling session using 1 monthly counseling credit.
 * No Stripe payment is created here; the subscription billing funds the credits.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (auth.status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    if (auth.status !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = auth.session;

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/counseling/book-with-credit',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const body = await request.json();
    const bookingState = body?.bookingState ?? null;

    const serviceRaw = String(bookingState?.service ?? '').trim().toLowerCase();
    const planRaw = String(bookingState?.plan ?? '').trim().toLowerCase();

    if (serviceRaw !== 'counseling' || planRaw !== 'counseling-monthly') {
      return NextResponse.json({ error: 'Invalid bookingState for credit booking' }, { status: 400 });
    }

    const studentId = session.userId;
    const providerId = typeof bookingState?.provider === 'string' ? bookingState.provider.trim() : '';
    if (!providerId) return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });

    // Validate providerId is a provider user
    const providerUser = await getUserById(providerId);
    if (!providerUser || !Array.isArray((providerUser as any)?.roles) || !(providerUser as any).roles.includes('provider')) {
      return NextResponse.json({ error: 'Invalid providerId (must be a real provider user id)' }, { status: 400 });
    }

    const studentUser = await getUserById(studentId);
    if (!studentUser) return NextResponse.json({ error: 'Student not found' }, { status: 400 });

    const studentName = typeof (studentUser as any)?.name === 'string' ? String((studentUser as any).name).trim() : '';
    const providerName = typeof (providerUser as any)?.name === 'string' ? String((providerUser as any).name).trim() : '';

    const extractProfileImageUrl = (u: any): string => {
      const v = u?.profileImageUrl ?? u?.profileImage ?? u?.profilePhotoUrl ?? u?.avatarUrl ?? u?.photoUrl ?? '';
      return typeof v === 'string' ? v.trim() : '';
    };
    const studentProfileImage = extractProfileImageUrl(studentUser) || null;
    const providerProfileImage = extractProfileImageUrl(providerUser) || null;

    const schoolNameRaw =
      (bookingState?.school?.name as string | undefined) ||
      (bookingState?.school?.displayName as string | undefined) ||
      (bookingState?.schoolName as string | undefined) ||
      '';
    const schoolName = String(schoolNameRaw || '').trim();

    const selectedSessions: Array<any> = Array.isArray(bookingState?.selectedSessions) ? bookingState.selectedSessions : [];
    if (selectedSessions.length !== 1) {
      return NextResponse.json({ error: 'Credit booking requires selecting exactly 1 session time' }, { status: 400 });
    }

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
      const end = new Date(date.getTime() + 60 * 60 * 1000).toISOString();
      return { start, end };
    };

    const s0 = selectedSessions[0] as any;
    const startTimeUTC = typeof s0?.startTimeUTC === 'string' ? s0.startTimeUTC : null;
    const endTimeUTC = typeof s0?.endTimeUTC === 'string' ? s0.endTimeUTC : null;
    const startEnd =
      startTimeUTC && endTimeUTC
        ? (() => {
            const startD = new Date(startTimeUTC);
            const endD = new Date(endTimeUTC);
            if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD <= startD) return null;
            return { start: startD.toISOString(), end: endD.toISOString() };
          })()
        : buildStartEnd(s0?.date, s0?.time);

    if (!startEnd) return NextResponse.json({ error: 'Invalid session time selection' }, { status: 400 });

    // Enforce 60 minutes for counseling
    const durationMinutes = Math.round((new Date(startEnd.end).getTime() - new Date(startEnd.start).getTime()) / (1000 * 60));
    if (durationMinutes !== 60) {
      return NextResponse.json({ error: 'Counseling sessions must be 60 minutes' }, { status: 400 });
    }

    // Prevent student double-booking (across ALL services) before reserving/consuming credits.
    try {
      await assertNoStudentDoubleBooking({
        studentId,
        newStart: startEnd.start,
        newEnd: startEnd.end,
      });
    } catch (e) {
      if (e instanceof DoubleBookingError) {
        return NextResponse.json({ error: DOUBLE_BOOKING_MESSAGE }, { status: 400 });
      }
      throw e;
    }

    // Require an available credit before reserving slot.
    const remaining = getCounselingMonthlyCreditsRemaining(studentId);
    if (remaining <= 0) {
      return NextResponse.json({ error: 'No counseling monthly credits available' }, { status: 402 });
    }

    // Reserve the slot atomically to prevent races.
    const slot = { providerId, startTime: startEnd.start, endTime: startEnd.end };
    const reserveResult = await reserveSlotsAtomically([slot]);
    if (!reserveResult.ok) {
      return NextResponse.json({ error: 'This time slot was just booked by someone else. Please pick another time.' }, { status: 409 });
    }

    // Consume a credit (after reserve, before session create); if session create fails we do NOT refund credit automatically.
    // (Credits are backed by Stripe invoice history; manual adjustment can be done via admin if needed.)
    const credit = consumeOneCounselingMonthlyCredit(studentId);

    const pricing = getSessionPricingCents({ service_type: 'counseling', plan: 'monthly', duration_minutes: 60 });
    const nowIso = new Date().toISOString();
    const providerPayout = getProviderPayout('college_counseling');
    const providerPayoutCents = Math.max(0, Math.floor(providerPayout * 100));

    try {
      const created = await createSession({
        id: crypto.randomUUID(),
        studentId,
        providerId,
        serviceType: 'college_counseling',
        serviceTypeId: 'college_counseling',
        service_type: 'counseling',
        plan: 'monthly',
        duration_minutes: 60,
        sessionType: 'counseling',
        school: schoolName || undefined,
        startTime: startEnd.start,
        endTime: startEnd.end,
        scheduledStartTime: startEnd.start,
        scheduledEndTime: startEnd.end,
        scheduledStart: startEnd.start,
        scheduledEnd: startEnd.end,
        status: 'confirmed',
        studentName: studentName || undefined,
        providerName: providerName || undefined,
        studentProfileImage,
        providerProfileImage,
        // Pricing (per-session allocation)
        session_price_cents: pricing.session_price_cents,
        provider_payout_cents: providerPayoutCents,
        providerPayout,
        providerPayoutCents,
        providerPayoutAmount: providerPayout,
        ivyway_take_cents: pricing.ivyway_take_cents,
        stripe_fee_cents: 0,
        // Backwards-compatible fields
        priceCents: pricing.session_price_cents,
        amountChargedCents: pricing.session_price_cents,
        amountRefundedCents: 0,
        isPaid: true,
        paidAt: nowIso,
        earningsCredited: false,
        bookedAt: nowIso,
        bookedBy: studentId,
        availabilityId: `${providerId}|${startEnd.start}|${startEnd.end}`,
        // Credit audit
        credit_bucket_id: credit.bucketId,
        stripeSubscriptionId: credit.stripeSubscriptionId,
      } as any);

      // Mark concrete inventory as booked (best-effort; do not block booking if it fails).
      try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from('availability_slots')
          .update({ is_booked: true })
          .eq('provider_id', providerId)
          .eq('service_type', 'college_counseling')
          .eq('start_time', startEnd.start)
          .eq('end_time', startEnd.end)
          .eq('is_booked', false);
        if (error) throw error;
      } catch (e) {
        console.warn('[AVAILABILITY_SLOT_BOOK_MARK_FAILED]', {
          providerId,
          start: startEnd.start,
          end: startEnd.end,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // Best-effort Zoom meeting creation
      if (isZoomConfigured()) {
        try {
          const topic = `College Counseling${schoolName ? ` - ${schoolName}` : ''}`;
          const zoom = await createZoomMeeting({ topic, startTime: startEnd.start, duration: 60 });
          const join_url = zoom.joinUrl;
          await updateSession(created.id, {
            zoomMeetingId: zoom.meetingId,
            zoom_join_url: join_url,
            zoomStartUrl: zoom.startUrl,
            zoomStatus: 'created',
          } as any);
          try {
            const supabase = getSupabaseAdmin();
            const { error } = await supabase
              .from('sessions')
              .update({ zoom_join_url: join_url })
              .eq('id', String(created.id));
            if (error) throw error;
            console.log("Saved to DB:", join_url);
          } catch (e) {
            console.error('[ZOOM_JOIN_URL_DB_SAVE_FAILED]', {
              sessionId: String(created.id),
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } catch {
          try {
            await updateSession(created.id, { zoomStatus: 'failed' } as any);
          } catch {}
        }
      }

      // Availability is READ-ONLY. Booked slots are excluded via sessions + reserved slots.

      // Transactional email: booking confirmation (idempotent per-session)
      try {
        const alreadyStudent = Boolean((created as any)?.bookingEmailStudentSentAt);
        const alreadyProvider = Boolean((created as any)?.bookingEmailProviderSentAt);
        if (!alreadyStudent || !alreadyProvider) {
          const sendResult = await sendBookingConfirmationEmailsForSession(created as any);
          const nowISO = new Date().toISOString();
          await updateSession(created.id, {
            bookingEmailStudentSentAt: sendResult.studentEmailSent ? nowISO : (created as any)?.bookingEmailStudentSentAt,
            bookingEmailProviderSentAt: sendResult.providerEmailSent ? nowISO : (created as any)?.bookingEmailProviderSentAt,
            confirmationEmailsSent: sendResult.studentEmailSent && sendResult.providerEmailSent,
            confirmationEmailsSentAt:
              sendResult.studentEmailSent && sendResult.providerEmailSent ? nowISO : (created as any)?.confirmationEmailsSentAt,
            updatedAt: nowISO,
          } as any);
        }
      } catch (e) {
        console.warn('[email] booking confirmation send failed (non-blocking)', {
          sessionId: created.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      return NextResponse.json({ sessionId: created.id, usedCreditBucketId: credit.bucketId });
    } catch (e) {
      // Roll back reservation if we failed before consuming the booked slot
      await unreserveSlotsAtomically([slot]);
      throw e;
    }
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/counseling/book-with-credit]' });
  }
}


