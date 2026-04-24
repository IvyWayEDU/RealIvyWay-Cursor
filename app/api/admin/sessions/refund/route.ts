import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function clampCents(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function computeEffectiveChargedCents(session: any): number {
  const totalCharge = clampCents(session?.total_charge_cents);
  const charged = clampCents(session?.amountChargedCents);
  const price = clampCents(session?.priceCents);
  return totalCharge || charged || price || 0;
}

type StripeRefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer';

function normalizeStripeReason(v: unknown): StripeRefundReason | undefined {
  const r = cleanString(v).toLowerCase();
  if (r === 'duplicate') return 'duplicate';
  if (r === 'fraudulent') return 'fraudulent';
  if (r === 'requested_by_customer' || r === 'requested-by-customer' || r === 'requested') return 'requested_by_customer';
  return undefined;
}

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = cleanString((body as any)?.sessionId);
    const amountCentsRaw = (body as any)?.amountCents;
    const note = cleanString((body as any)?.note);
    const stripeReason = normalizeStripeReason((body as any)?.stripeReason);

    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

    const existing = await getSessionById(sessionId);
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const s: any = existing as any;
    const paymentIntentId = cleanString(s?.stripePaymentIntentId);
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'This session has no Stripe payment intent reference.' }, { status: 400 });
    }

    const secretKey = cleanString(process.env.STRIPE_SECRET_KEY);
    if (!secretKey) return NextResponse.json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' }, { status: 500 });

    const effectiveChargedCents = computeEffectiveChargedCents(s);
    const alreadyRefundedCents = clampCents(s?.amountRefundedCents);
    const remainingRefundableCents = Math.max(0, effectiveChargedCents - alreadyRefundedCents);

    const requestedCents =
      amountCentsRaw == null || amountCentsRaw === ''
        ? remainingRefundableCents
        : Math.max(0, Math.floor(Number(amountCentsRaw)));

    if (!Number.isFinite(requestedCents) || requestedCents <= 0) {
      return NextResponse.json({ error: 'amountCents must be a positive integer (or omit for full remaining refund).' }, { status: 400 });
    }
    if (requestedCents > remainingRefundableCents) {
      return NextResponse.json(
        { error: `Refund amount exceeds remaining refundable amount (${remainingRefundableCents} cents).` },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: requestedCents,
      ...(stripeReason ? { reason: stripeReason } : {}),
      metadata: {
        ivyway_session_id: sessionId,
        admin_user_id: authResult.session!.userId,
      },
    });

    const refundedAmountCents = clampCents((refund as any)?.amount);
    const nowISO = new Date().toISOString();

    const nextRefundedTotal = alreadyRefundedCents + refundedAmountCents;
    const isFullyRefunded = effectiveChargedCents > 0 && nextRefundedTotal >= effectiveChargedCents;

    const patch: any = {
      amountRefundedCents: nextRefundedTotal,
      refundedAt: nowISO,
      lastRefundId: String((refund as any)?.id || ''),
      lastRefundStatus: typeof (refund as any)?.status === 'string' ? (refund as any).status : undefined,
      lastRefundReason: stripeReason || undefined,
      updatedAt: nowISO,
    };

    if (note) {
      patch.adminNotes = note;
    }

    // If fully refunded, mark session status explicitly (terminal).
    if (isFullyRefunded) {
      patch.status = 'refunded';
      // Conservative default: prevent any automated payout processing.
      patch.payoutStatus = 'locked';
    }

    const ok = await updateSession(sessionId, patch);
    if (!ok) return NextResponse.json({ error: 'Failed to persist refund state on session.' }, { status: 500 });

    await appendAdminAuditEntry({
      action: 'REFUND_SESSION',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
      metadata: {
        stripeRefundId: String((refund as any)?.id || ''),
        stripePaymentIntentId: paymentIntentId,
        amountCents: refundedAmountCents,
        requestedAmountCents: requestedCents,
        effectiveChargedCents,
        nextRefundedTotalCents: nextRefundedTotal,
        fullyRefunded: isFullyRefunded,
        note: note || undefined,
        stripeReason: stripeReason || undefined,
      },
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json(
      {
        success: true,
        refund: {
          id: String((refund as any)?.id || ''),
          amountCents: refundedAmountCents,
          status: typeof (refund as any)?.status === 'string' ? (refund as any).status : null,
          created: typeof (refund as any)?.created === 'number' ? (refund as any).created : null,
        },
        session: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/refund]' });
  }
}

