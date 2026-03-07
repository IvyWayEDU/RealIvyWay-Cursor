'use server';

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { createWithdrawalRequest } from '@/lib/payouts/withdrawal-storage';
import { getProviderPayoutSummary } from '@/lib/payouts/actions';
import { getBankAccount } from '@/lib/payouts/bank-account-storage';
// RATE LIMITING
import { checkBookingRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting/index';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { withdrawalRequestSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and provider role
    const authResult = await auth.requireProvider();
    if (authResult.error) return Response.json({ success: false, error: authResult.error.status === 401 ? 'Unauthorized' : 'Forbidden: Only providers can create withdrawal requests' }, { status: authResult.error.status });
    const session = authResult.session!;

    // RATE LIMITING: Check booking rate limit (prevent rapid-fire withdrawal requests)
    const rateLimitResult = checkBookingRateLimit(request, session.userId, '/api/payouts/withdrawal-request');
    if (!rateLimitResult.allowed) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Please wait before attempting to withdraw again.' },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Validate request body with schema
    const validationResult = await validateRequestBody(request, withdrawalRequestSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { amountCents } = validationResult.data;

    const providerId = session.userId;

    // Check if provider has a persisted bank account
    const bankAccount = await getBankAccount(providerId);
    if (!bankAccount) {
      return Response.json({ success: false, error: 'Bank account required. Please connect a bank account first.' }, { status: 400 });
    }

    // Get available balance (already accounts for pending withdrawals)
    const summary = await getProviderPayoutSummary(providerId);
    if (!summary.success) {
      return Response.json({ success: false, error: summary.error || 'Failed to get available balance' }, { status: 500 });
    }

    const availableBalanceCents = summary.availableBalanceCents || 0;

    // Validate amount doesn't exceed available balance
    if (amountCents > availableBalanceCents) {
      return Response.json({ 
        success: false, 
        error: `Invalid amount. Amount cannot exceed available balance of $${(availableBalanceCents / 100).toFixed(2)}.` 
      }, { status: 400 });
    }

    // Create withdrawal request
    const withdrawalRequest = createWithdrawalRequest({
      providerId,
      amountCents,
      status: 'pending',
    });

    return Response.json({ success: true, withdrawalRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

