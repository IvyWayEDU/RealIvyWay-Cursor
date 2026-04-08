import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getAuthContext } from '@/lib/auth/session';
import { getProviderByUserId } from '@/lib/providers/storage';
import { createPayoutRequest } from '@/lib/payouts/payout-requests.server';
import { buildPayoutRequestSnapshot, normalizePayoutMethod } from '@/lib/payouts/payout-snapshot';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { getProviderEarningsBalance, updateProviderEarningsBalance } from '@/lib/earnings/balances.server';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { withdrawalRequestSchema } from '@/lib/validation/schemas';
import type { ProviderProfile } from '@/lib/models/types';

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

    // Source of truth: provider_earnings_balances
    const balance = await getProviderEarningsBalance(providerId);
    const availableCents = Math.max(0, Math.floor(balance.availableCents || 0));
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

    console.log("Withdrawal using balance only");

    // Step 4: Process withdrawal using balance only
    const new_available = Math.max(0, Math.floor((balance.availableCents || 0) - requestedCents));
    const new_pending = Math.max(0, Math.floor((balance.pendingCents || 0) + requestedCents));

    await updateProviderEarningsBalance({
      providerId,
      availableCents: new_available,
      pendingCents: new_pending,
      withdrawnCents: balance.withdrawnCents || 0,
    });

    const snapshot = buildPayoutRequestSnapshot({ provider, bankMeta: null });

    // Create payout request (admin-facing approval flow)
    let payoutRequest: any;
    try {
      payoutRequest = await createPayoutRequest({
        providerId,
        amountCents: requestedCents,
        // Step 5: Insert payout request WITHOUT allocations.
        // allocations = null, allocations_inferred = true
        allocationsInferred: true,
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
    } catch (e) {
      // Best-effort rollback: restore the balance if payout request insert fails.
      console.error('[withdrawal-request] payout request insert failed after balance reservation; attempting rollback', {
        providerId,
        requestedCents,
        error: e,
      });
      try {
        await updateProviderEarningsBalance({
          providerId,
          availableCents: balance.availableCents || 0,
          pendingCents: balance.pendingCents || 0,
          withdrawnCents: balance.withdrawnCents || 0,
        });
      } catch (rollbackErr) {
        console.error('[withdrawal-request] rollback failed', { providerId, rollbackErr });
      }
      throw e;
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

