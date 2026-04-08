import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getAuthContext } from '@/lib/auth/session';
import { getProviderByUserId } from '@/lib/providers/storage';
import {
  createPayoutRequest,
  listProviderPayoutRequests,
  updatePayoutRequestAllocations,
  type PayoutAllocation,
} from '@/lib/payouts/payout-requests.server';
import { getProviderPayoutSummaryFromLedger } from '@/lib/payouts/summary.server';
import { buildPayoutRequestSnapshot, normalizePayoutMethod } from '@/lib/payouts/payout-snapshot';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { getProviderEarningsBalance, updateProviderEarningsBalance } from '@/lib/earnings/balances.server';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { withdrawalRequestSchema } from '@/lib/validation/schemas';
import type { ProviderProfile } from '@/lib/models/types';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';

function toIsoOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v : '';
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function sessionCompletedAtIso(session: any): string | null {
  return (
    toIsoOrNull(session?.completedAt) ||
    toIsoOrNull(session?.actualEndTime) ||
    toIsoOrNull(session?.endTime) ||
    toIsoOrNull(session?.scheduledEndTime) ||
    toIsoOrNull(session?.updatedAt) ||
    null
  );
}

function hasManualPayoutDetails(provider: ProviderProfile | null, normalizedMethod: ReturnType<typeof normalizePayoutMethod>): boolean {
  const p: any = provider as any;
  if (normalizedMethod === 'bank') {
    return Boolean(
      typeof p?.bankName === 'string' &&
        p.bankName.trim() &&
        typeof p?.bankAccountNumber === 'string' &&
        p.bankAccountNumber.trim() &&
        typeof p?.bankRoutingNumber === 'string' &&
        p.bankRoutingNumber.trim() &&
        typeof p?.bankCountry === 'string' &&
        p.bankCountry.trim()
    );
  }
  if (normalizedMethod === 'wise') {
    return Boolean(typeof p?.wiseEmail === 'string' && p.wiseEmail.trim());
  }
  if (normalizedMethod === 'paypal') {
    return Boolean(typeof p?.paypalEmail === 'string' && p.paypalEmail.trim());
  }
  if (normalizedMethod === 'zelle') {
    return Boolean(typeof p?.zelleContact === 'string' && p.zelleContact.trim());
  }
  return false;
}

function allocateFromSessions(args: {
  sessions: Array<{ sessionId: string; payoutCents: number; completedAtIso: string }>;
  alreadyAllocatedBySession: Map<string, number>;
  amountToAllocateCents: number;
}): { allocations: PayoutAllocation[]; remainingCents: number } {
  let remaining = Math.max(0, Math.floor(args.amountToAllocateCents || 0));
  const out: PayoutAllocation[] = [];

  for (const s of args.sessions) {
    if (remaining <= 0) break;
    const payout = Math.max(0, Math.floor(s.payoutCents || 0));
    if (payout <= 0) continue;
    const used = Math.max(0, Math.floor(args.alreadyAllocatedBySession.get(s.sessionId) || 0));
    const available = Math.max(0, payout - used);
    if (available <= 0) continue;
    const take = Math.min(remaining, available);
    if (take <= 0) continue;
    out.push({ sessionId: s.sessionId, amountCents: take });
    args.alreadyAllocatedBySession.set(s.sessionId, used + take);
    remaining -= take;
  }

  return { allocations: out, remainingCents: remaining };
}

export async function POST(request: NextRequest) {
  try {
    // AUTH: Use the same helper as known-working provider dashboard routes.
    const authResult = await auth.requireProvider();
    if (authResult.error) {
      // Provide a more detailed reason temporarily.
      const ctx = await getAuthContext();
      if (ctx.status !== 'ok') {
        return NextResponse.json({ success: false, error: 'Unauthorized: no session' }, { status: 401 });
      }
      if (!ctx.session?.userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized: no user id' }, { status: 401 });
      }
      return NextResponse.json({ success: false, error: 'Unauthorized: wrong role' }, { status: 403 });
    }

    const session = authResult.session!;

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/payouts/withdrawal-request',
      body: { success: false, error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const provider = await getProviderByUserId(session.userId);
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Unauthorized: provider not found' }, { status: 404 });
    }

    // WITHDRAWAL VALIDATION: provider must be active
    if ((provider as any)?.active === false) {
      return NextResponse.json(
        { success: false, error: 'Provider account is inactive' },
        { status: 403 }
      );
    }

    // Validate request body with schema
    const validationResult = await validateRequestBody(request, withdrawalRequestSchema);
    if (!validationResult.success) {
      console.error('[withdrawal-request] 400: request body validation failed', {
        error: validationResult.error,
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Withdrawal failed: invalid withdrawal amount',
          error: validationResult.error.message,
          details: validationResult.error.kind === 'zod' ? validationResult.error.details : undefined,
        },
        { status: 400 }
      );
    }
    const requestedAmount = validationResult.data.requestedAmount ?? validationResult.data.amount;
    const amountCents = validationResult.data.amountCents;

    const providerId = session.userId;

    const normalizedMethod = normalizePayoutMethod((provider as any)?.payoutMethod);

    // Manual payouts: providers must have method-specific payout details configured.
    // Do NOT require any Stripe account id or "verified" flag.
    if (!hasManualPayoutDetails(provider as ProviderProfile, normalizedMethod)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please complete your payout details before requesting a withdrawal.',
          error: 'Please complete your payout details before requesting a withdrawal.',
        },
        { status: 400 }
      );
    }

    // Get available balance from the canonical ledger + payout-request totals.
    const payoutSummary = await getProviderPayoutSummaryFromLedger(providerId);
    const availableBalanceCents = payoutSummary.availableBalanceCents || 0;

    const availableCents = Math.max(0, Math.floor(availableBalanceCents));
    const requestedCents =
      typeof requestedAmount === 'number' && Number.isFinite(requestedAmount)
        ? Math.round(requestedAmount * 100)
        : Math.round(Number(amountCents || 0));

    if (requestedCents <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount', error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (requestedCents > availableCents) {
      console.error('[withdrawal-request] 400: insufficient balance', {
        requestedCents,
        availableCents,
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Insufficient balance',
          error: 'Insufficient balance',
        },
        { status: 400 }
      );
    }

    // Build deterministic per-session allocations so admins can trace payouts back to bookings.
    // This also backfills allocations for legacy payout requests (marked inferred) so new requests
    // don't overlap already-withdrawn amounts.
    const providerSessions = await getSessionsByProviderId(providerId);
    const completed = (providerSessions || [])
      .filter((s: any) => {
        const status = String(s?.status || '').trim().toLowerCase();
        if (status !== 'completed') return false;
        const providerEarned = (s as any)?.providerEarned;
        const provider_earned = (s as any)?.provider_earned;
        const earned =
          typeof providerEarned === 'boolean' ? providerEarned : typeof provider_earned === 'boolean' ? provider_earned : false;
        return earned === true;
      })
      .map((s: any) => {
        const completedAtIso = sessionCompletedAtIso(s) || new Date().toISOString();
        return {
          sessionId: String(s?.id || '').trim(),
          completedAtIso,
          payoutCents: calculateProviderPayoutCentsFromSession(s as any),
        };
      })
      .filter((s) => s.sessionId && s.payoutCents > 0)
      .sort((a, b) => String(a.completedAtIso).localeCompare(String(b.completedAtIso)));

    console.log("Completed sessions found:", completed.length);

    const existingRequests = await listProviderPayoutRequests(providerId);
    const alreadyAllocatedBySession = new Map<string, number>();

    // 1) Apply explicit allocations and infer + persist missing ones (legacy).
    const existingChrono = [...(existingRequests || [])].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    for (const r of existingChrono as any[]) {
      const status = String(r?.status || '').trim().toLowerCase();
      if (status === 'rejected') continue;
      const amount = Math.max(0, Math.floor(Number(r?.amountCents || 0)));
      if (amount <= 0) continue;

      const allocationsRaw = Array.isArray(r?.allocations) ? (r.allocations as any[]) : null;
      if (allocationsRaw && allocationsRaw.length > 0) {
        for (const a of allocationsRaw) {
          const sid = String(a?.sessionId || '').trim();
          const cents = Math.max(0, Math.floor(Number(a?.amountCents || 0)));
          if (!sid || cents <= 0) continue;
          alreadyAllocatedBySession.set(sid, (alreadyAllocatedBySession.get(sid) || 0) + cents);
        }
        continue;
      }

      // Infer allocations for legacy requests (FIFO by completion time) and persist for auditability.
      const inferred = allocateFromSessions({
        sessions: completed,
        alreadyAllocatedBySession,
        amountToAllocateCents: amount,
      });

      const inferredAllocations = inferred.allocations;
      const remainder = inferred.remainingCents;
      const finalAllocations =
        remainder > 0 ? [...inferredAllocations, { sessionId: '__unattributed__', amountCents: remainder }] : inferredAllocations;

      await updatePayoutRequestAllocations({
        id: String(r.id || ''),
        allocations: finalAllocations,
        allocationsInferred: true,
      });
    }

    // 2) Allocate this new request from remaining per-session earnings.
    const alloc = allocateFromSessions({
      sessions: completed,
      alreadyAllocatedBySession,
      amountToAllocateCents: requestedCents,
    });
    const finalAllocations =
      alloc.remainingCents > 0
        ? [...alloc.allocations, { sessionId: '__unattributed__', amountCents: alloc.remainingCents }]
        : alloc.allocations;

    if (alloc.remainingCents > 0) {
      console.warn('[withdrawal-request] allocations include unattributed remainder', {
        requestedCents,
        remainingCents: alloc.remainingCents,
        completedSessionsCount: completed.length,
      });
    }

    const snapshot = buildPayoutRequestSnapshot({ provider, bankMeta: null });

    // Create payout request (admin-facing approval flow)
    const payoutRequest = await createPayoutRequest({
      providerId,
      amountCents: requestedCents,
      allocations: finalAllocations,
      payoutMethod: snapshot.payoutMethod,
      payoutDestinationMasked: snapshot.payoutDestinationMasked,
      // legacy (keep populated for older UI codepaths that still look here)
      payoutDestination: snapshot.payoutDestinationMasked,
      bankName: snapshot.bankName,
      bankAccountNumber: snapshot.bankAccountNumber,
      bankRoutingNumber: snapshot.bankRoutingNumber,
      bankCountry: snapshot.bankCountry,
      accountHolderName: snapshot.accountHolderName,
      wiseEmail: snapshot.wiseEmail,
      paypalEmail: snapshot.paypalEmail,
      zelleContact: snapshot.zelleContact,
    });

    // Update provider earnings balance: reserve funds for pending payout.
    // Order requirement: create payout request FIRST, update balance SECOND.
    try {
      const balance = await getProviderEarningsBalance(providerId);
      console.log('Before withdrawal:', balance);
      const new_available = Math.max(0, Math.floor((balance.availableCents || 0) - requestedCents));
      const new_pending = Math.max(0, Math.floor((balance.pendingCents || 0) + requestedCents));

      const updated = await updateProviderEarningsBalance({
        providerId,
        availableCents: new_available,
        pendingCents: new_pending,
        withdrawnCents: balance.withdrawnCents || 0,
      });

      console.log('After withdrawal:', new_available, new_pending);
      // Useful in case a trigger modified values (or row was created).
      console.log('[withdrawal-request] balance row updated', {
        providerId,
        availableCents: updated.availableCents,
        pendingCents: updated.pendingCents,
        withdrawnCents: updated.withdrawnCents,
      });
    } catch (e) {
      // We do NOT fail the request here because the payout request is already created.
      // If this fails, we want visibility via logs so we can reconcile.
      console.error('[withdrawal-request] balance update failed after creating payout request', {
        providerId,
        payoutRequestId: String((payoutRequest as any)?.id || ''),
        requestedCents,
        error: e,
      });
    }

    console.log('[api/payouts/withdrawal-request] Withdrawal request created', {
      payoutRequestId: String((payoutRequest as any)?.id || ''),
    });
    return NextResponse.json({ success: true, payoutRequest }, { status: 201 });
  } catch (error) {
    console.error('[withdrawal-request] unexpected error', error);
    return handleApiError(error, { logPrefix: '[api/payouts/withdrawal-request]' });
  }
}

