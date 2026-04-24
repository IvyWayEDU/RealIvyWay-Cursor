import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { appendAdminAuditEntry } from '@/lib/audit/adminAudit.server';
import { handleApiError } from '@/lib/errorHandler';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';

export const runtime = 'nodejs';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeStatus(v: unknown): string {
  return cleanString(v).toLowerCase();
}

function hasIso(v: unknown): boolean {
  if (typeof v !== 'string' || !v.trim()) return false;
  const t = new Date(v).getTime();
  return Number.isFinite(t);
}

type AdminSettableStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'provider_no_show'
  | 'student_no_show'
  | 'disputed'
  | 'refunded';

const ALLOWED = new Set<AdminSettableStatus>([
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'provider_no_show',
  'student_no_show',
  'disputed',
  'refunded',
]);

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = cleanString((body as any)?.sessionId);
    const nextStatusRaw = normalizeStatus((body as any)?.status);
    const note = cleanString((body as any)?.note);

    if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    if (!nextStatusRaw) return NextResponse.json({ error: 'status is required' }, { status: 400 });

    const nextStatus = (nextStatusRaw === 'scheduled' ? 'confirmed' : nextStatusRaw) as AdminSettableStatus;
    if (!ALLOWED.has(nextStatus)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${Array.from(ALLOWED).join(', ')}` }, { status: 400 });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const s: any = existing as any;
    const nowISO = new Date().toISOString();

    const grossCents = Math.max(0, Math.floor(getSessionGrossCents(s)));

    const providerJoinedAt = cleanString(s?.providerJoinedAt);
    const providerHasJoinEvidence = Boolean(providerJoinedAt) && hasIso(providerJoinedAt);

    const basePatch: any = {
      status: nextStatus,
      updatedAt: nowISO,
    };
    if (note) basePatch.adminNotes = note;

    let patch: any = { ...basePatch };

    if (nextStatus === 'cancelled') {
      patch = {
        ...patch,
        cancelledAt: nowISO,
        cancelledBy: authResult.session!.userId,
        cancellationReason: 'admin-request',
        cancellationNote: note || undefined,
      };
    }

    if (nextStatus === 'provider_no_show') {
      patch = {
        ...patch,
        markedNoShowAt: s?.markedNoShowAt || nowISO,
        markedNoShowBy: authResult.session!.userId,
        noShowParty: 'provider',
        attendanceFlag: 'provider_no_show',
        providerEligibleForPayout: false,
        providerEarned: false,
        flagNoShowProvider: true,
        requiresAdminReview: true,
        providerPayoutCents: 0,
        providerPayoutAmount: 0,
        providerPayout: 0,
        platformFeeCents: grossCents,
        payoutStatus: 'unpaid',
      };
    }

    if (nextStatus === 'student_no_show') {
      if (!providerHasJoinEvidence) {
        return NextResponse.json(
          { error: 'Cannot set student_no_show without provider join evidence. Use provider_no_show if provider did not attend.' },
          { status: 400 }
        );
      }
      const payoutCents = Math.max(0, Math.floor(calculateProviderPayoutCentsFromSession(s)));
      patch = {
        ...patch,
        markedNoShowAt: s?.markedNoShowAt || nowISO,
        markedNoShowBy: authResult.session!.userId,
        noShowParty: 'student',
        attendanceFlag: 'none',
        providerEligibleForPayout: true,
        providerEarned: true,
        flagNoShowProvider: false,
        flagNoShowStudent: true,
        providerPayoutCents: payoutCents,
        providerPayoutAmount: payoutCents / 100,
        providerPayout: payoutCents / 100,
        platformFeeCents: Math.max(0, grossCents - payoutCents),
        payoutStatus: s?.payoutStatus || 'available',
      };
    }

    if (nextStatus === 'completed') {
      if (!providerHasJoinEvidence) {
        return NextResponse.json(
          { error: 'Cannot set completed without provider join evidence. Use provider_no_show for no-show outcomes.' },
          { status: 400 }
        );
      }
      const payoutCents = Math.max(0, Math.floor(calculateProviderPayoutCentsFromSession(s)));
      patch = {
        ...patch,
        completedAt: s?.completedAt || nowISO,
        actualStartTime: s?.actualStartTime || providerJoinedAt || undefined,
        actualEndTime: s?.actualEndTime || nowISO,
        providerEligibleForPayout: true,
        providerEarned: true,
        flagNoShowProvider: false,
        providerPayoutCents: payoutCents,
        providerPayoutAmount: payoutCents / 100,
        providerPayout: payoutCents / 100,
        platformFeeCents: Math.max(0, grossCents - payoutCents),
        payoutStatus: s?.payoutStatus || 'available',
      };
    }

    if (nextStatus === 'refunded') {
      const refundedCents = Math.max(0, Math.floor(Number(s?.amountRefundedCents || 0)));
      if (refundedCents <= 0) {
        return NextResponse.json({ error: 'Cannot set refunded without amountRefundedCents > 0. Issue a Stripe refund first.' }, { status: 400 });
      }
      patch = {
        ...patch,
        refundedAt: s?.refundedAt || nowISO,
        payoutStatus: 'locked',
      };
    }

    if (nextStatus === 'disputed') {
      patch = {
        ...patch,
        disputedAt: s?.disputedAt || nowISO,
        disputedBy: authResult.session!.userId,
        requiresAdminReview: true,
      };
    }

    const ok = await updateSession(sessionId, patch);
    if (!ok) return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });

    // If admin set to completed, ensure earnings are credited (idempotent).
    if (nextStatus === 'completed') {
      try {
        const providerId = cleanString(s?.providerId);
        if (providerId) {
          const { addCreditForSession } = await import('@/lib/earnings/credits.server');
          const cents = Math.max(0, Math.floor(calculateProviderPayoutCentsFromSession({ ...s, ...patch } as any)));
          if (cents > 0) {
            await addCreditForSession({ providerId, sessionId, amountCents: cents });
            await updateSession(sessionId, { earningsCredited: true, earningsCreditedAt: nowISO, updatedAt: nowISO } as any);
          }
        }
      } catch {
        // non-blocking
      }
    }

    await appendAdminAuditEntry({
      action: 'SET_SESSION_STATUS',
      adminUserId: authResult.session!.userId,
      sessionId,
      timestamp: nowISO,
      metadata: {
        fromStatus: cleanString(s?.status) || null,
        toStatus: nextStatus,
        note: note || undefined,
      },
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ success: true, session: updated }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/sessions/set-status]' });
  }
}

