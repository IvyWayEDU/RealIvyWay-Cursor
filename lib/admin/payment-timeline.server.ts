import 'server-only';

import { getSessionById } from '@/lib/sessions/storage';
import { readCredits } from '@/lib/earnings/credits.server';
import { getPayoutRequestById, listProviderPayoutRequests, type PayoutRequest } from '@/lib/payouts/payout-requests.server';

export type PaymentTimelineEventKind =
  | 'student_payment_received'
  | 'session_completed'
  | 'provider_earnings_credited'
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'payout_sent';

export type PaymentTimelineEvent = {
  at: string; // ISO
  kind: PaymentTimelineEventKind;
  title: string;
  amountCents?: number;
  ref?: { type: 'session' | 'payout_request' | 'credit'; id: string };
  meta?: Record<string, any>;
};

function isIso(v: unknown): v is string {
  if (typeof v !== 'string' || !v.trim()) return false;
  const d = new Date(v);
  return Number.isFinite(d.getTime());
}

function isoOrNull(v: unknown): string | null {
  return isIso(v) ? new Date(v).toISOString() : null;
}

function clampCents(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function sessionPaymentAtIso(session: any): string | null {
  return isoOrNull(session?.paidAt) || isoOrNull(session?.bookedAt) || isoOrNull(session?.createdAt) || null;
}

function sessionCompletedAtIso(session: any): string | null {
  return (
    isoOrNull(session?.completedAt) ||
    isoOrNull(session?.actualEndTime) ||
    isoOrNull(session?.endTime) ||
    isoOrNull(session?.scheduledEndTime) ||
    isoOrNull(session?.updatedAt) ||
    null
  );
}

function sessionStudentPaymentCents(session: any): number | null {
  const refunded = clampCents(session?.amountRefundedCents);
  const totalCharge = clampCents(session?.total_charge_cents);
  const charged = clampCents(session?.amountChargedCents);
  const price = clampCents(session?.priceCents);
  const gross = totalCharge || charged || price || 0;
  const net = Math.max(0, gross - refunded);
  return net > 0 ? net : null;
}

function allocationSumForSession(pr: PayoutRequest, sessionId: string): number {
  const allocs = Array.isArray((pr as any)?.allocations) ? ((pr as any).allocations as any[]) : [];
  let sum = 0;
  for (const a of allocs) {
    if (String(a?.sessionId || '') !== sessionId) continue;
    sum += clampCents(a?.amountCents);
  }
  return clampCents(sum);
}

function pushIfAt(events: PaymentTimelineEvent[], e: Omit<PaymentTimelineEvent, 'at'> & { at: string | null }) {
  if (!e.at) return;
  events.push({ ...(e as any), at: e.at });
}

export async function getAdminSessionPaymentTimeline(sessionId: string): Promise<{
  sessionId: string;
  providerId: string | null;
  payoutRequestIds: string[];
  events: PaymentTimelineEvent[];
}> {
  const session = await getSessionById(sessionId);
  if (!session) {
    return { sessionId, providerId: null, payoutRequestIds: [], events: [] };
  }

  const s: any = session as any;
  const providerId = typeof s.providerId === 'string' && s.providerId.trim() ? s.providerId.trim() : null;

  const events: PaymentTimelineEvent[] = [];

  // Student payment received
  const paidAt = sessionPaymentAtIso(s);
  const paidCents = sessionStudentPaymentCents(s);
  pushIfAt(events, {
    at: paidAt,
    kind: 'student_payment_received',
    title: 'Student payment received',
    amountCents: paidCents ?? undefined,
    ref: { type: 'session', id: sessionId },
    meta: {
      stripePaymentIntentId: typeof s?.stripePaymentIntentId === 'string' ? s.stripePaymentIntentId : undefined,
    },
  });

  // Session completed
  pushIfAt(events, {
    at: sessionCompletedAtIso(s),
    kind: 'session_completed',
    title: 'Session completed',
    ref: { type: 'session', id: sessionId },
    meta: { status: s?.status },
  });

  // Provider earnings credited (credits store is the timestamp source-of-truth)
  try {
    const credits = await readCredits();
    const credit = (credits || []).find((c) => String((c as any)?.sessionId || '') === sessionId) as any;
    if (credit) {
      pushIfAt(events, {
        at: isoOrNull(credit.createdAt),
        kind: 'provider_earnings_credited',
        title: 'Provider earnings credited',
        amountCents: clampCents(credit.amountCents) || undefined,
        ref: { type: 'credit', id: String(credit.id || `${sessionId}-credit`) },
        meta: { providerId: String(credit.providerId || providerId || '') || undefined },
      });
    }
  } catch {
    // ignore credits store failures
  }

  // Payout requests tied to this session via allocations
  const payoutRequestIds: string[] = [];
  if (providerId) {
    const prs = await listProviderPayoutRequests(providerId);
    for (const pr of prs || []) {
      const sum = allocationSumForSession(pr, sessionId);
      if (sum <= 0) continue;
      payoutRequestIds.push(String(pr.id || ''));

      pushIfAt(events, {
        at: isoOrNull((pr as any)?.createdAt),
        kind: 'withdrawal_requested',
        title: 'Withdrawal requested',
        amountCents: sum || undefined,
        ref: { type: 'payout_request', id: String(pr.id || '') },
        meta: { status: pr.status, allocationsInferred: (pr as any)?.allocationsInferred === true },
      });

      pushIfAt(events, {
        at: isoOrNull((pr as any)?.approvedAt),
        kind: 'withdrawal_approved',
        title: 'Withdrawal approved',
        amountCents: sum || undefined,
        ref: { type: 'payout_request', id: String(pr.id || '') },
        meta: { status: pr.status, allocationsInferred: (pr as any)?.allocationsInferred === true },
      });

      pushIfAt(events, {
        at: isoOrNull((pr as any)?.paidAt),
        kind: 'payout_sent',
        title: 'Payout sent',
        amountCents: sum || undefined,
        ref: { type: 'payout_request', id: String(pr.id || '') },
        meta: { status: pr.status, allocationsInferred: (pr as any)?.allocationsInferred === true },
      });
    }
  }

  events.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return {
    sessionId,
    providerId,
    payoutRequestIds: payoutRequestIds.filter(Boolean),
    events,
  };
}

export async function getAdminPayoutPaymentTimeline(payoutRequestId: string): Promise<{
  payoutRequestId: string;
  payoutRequest: PayoutRequest | null;
  events: PaymentTimelineEvent[];
  allocations: Array<{ sessionId: string; amountCents: number }>;
}> {
  const pr = payoutRequestId ? await getPayoutRequestById(payoutRequestId) : null;
  if (!pr) return { payoutRequestId, payoutRequest: null, events: [], allocations: [] };

  const events: PaymentTimelineEvent[] = [];
  pushIfAt(events, {
    at: isoOrNull((pr as any)?.createdAt),
    kind: 'withdrawal_requested',
    title: 'Withdrawal requested',
    amountCents: clampCents((pr as any)?.amountCents) || undefined,
    ref: { type: 'payout_request', id: String(pr.id || payoutRequestId) },
    meta: { status: pr.status, allocationsInferred: (pr as any)?.allocationsInferred === true },
  });
  pushIfAt(events, {
    at: isoOrNull((pr as any)?.approvedAt),
    kind: 'withdrawal_approved',
    title: 'Withdrawal approved',
    amountCents: clampCents((pr as any)?.amountCents) || undefined,
    ref: { type: 'payout_request', id: String(pr.id || payoutRequestId) },
    meta: { status: pr.status, allocationsInferred: (pr as any)?.allocationsInferred === true },
  });
  pushIfAt(events, {
    at: isoOrNull((pr as any)?.paidAt),
    kind: 'payout_sent',
    title: 'Payout sent',
    amountCents: clampCents((pr as any)?.amountCents) || undefined,
    ref: { type: 'payout_request', id: String(pr.id || payoutRequestId) },
    meta: { status: pr.status, allocationsInferred: (pr as any)?.allocationsInferred === true },
  });

  const allocations = Array.isArray((pr as any)?.allocations)
    ? ((pr as any).allocations as any[])
        .map((a) => ({
          sessionId: String(a?.sessionId || '').trim(),
          amountCents: clampCents(a?.amountCents),
        }))
        .filter((a) => a.sessionId && a.amountCents > 0)
    : [];

  events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { payoutRequestId, payoutRequest: pr, events, allocations };
}

