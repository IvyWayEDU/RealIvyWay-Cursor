'use server';

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { setBankAccount, getBankAccount } from '@/lib/payouts/bank-account-storage';
import { updateProviderPayoutDetailsByUserId } from '@/lib/providers/storage';
import { handleApiError } from '@/lib/errorHandler';
// RATE LIMITING
import { checkBookingRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting/index';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { bankAccountSchema } from '@/lib/validation/schemas';

export async function GET() {
  try {
    // SECURITY: Require authentication and provider role
    const authResult = await auth.requireProvider();
    if (authResult.error) return Response.json({ success: false, error: authResult.error.status === 401 ? 'Unauthorized' : 'Forbidden: Only providers can view bank accounts' }, { status: authResult.error.status });
    const session = authResult.session!;

    const providerId = session.userId;
    const bankAccount = await getBankAccount(providerId);

    return Response.json({ success: true, bankAccount }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/payouts/bank-account] GET' });
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and provider role
    const authResult = await auth.requireProvider();
    if (authResult.error) return Response.json({ success: false, error: authResult.error.status === 401 ? 'Unauthorized' : 'Forbidden: Only providers can manage bank accounts' }, { status: authResult.error.status });
    const session = authResult.session!;

    // RATE LIMITING: Check booking rate limit (prevent rapid-fire bank account updates)
    const rateLimitResult = checkBookingRateLimit(request, session.userId, '/api/payouts/bank-account');
    if (!rateLimitResult.allowed) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Please wait before attempting to update bank account again.' },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Validate request body with schema
    const validationResult = await validateRequestBody(request, bankAccountSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { bankName, accountHolderName, routingNumber, accountNumber, accountType } = validationResult.data;

    const providerId = session.userId;

    // Required debug log (requested)
    console.log('Saving bank account:', providerId);

    // Save bank account (Supabase-backed; metadata returned is masked)
    const bankAccount = await setBankAccount(providerId, {
      bankName: bankName.trim(),
      accountName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      routingNumber: routingNumber.trim(),
      accountType,
    });

    // ALSO persist full payout details to the provider profile so admin payout processing
    // can snapshot and display the real destination details in the admin modal.
    // (These fields are admin-only surfaces; do not expose full details in tables.)
    await updateProviderPayoutDetailsByUserId(providerId, {
      payoutMethod: 'bank',
      bankName: bankName.trim(),
      bankCountry: 'US',
      bankAccountNumber: accountNumber.trim(),
      bankRoutingNumber: routingNumber.trim(),
      accountHolderName: accountHolderName.trim(),
    } as any);

    // Return bank account metadata (already contains only last4, no sensitive data)
    return Response.json({ success: true, bankAccount }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/payouts/bank-account] POST' });
  }
}

