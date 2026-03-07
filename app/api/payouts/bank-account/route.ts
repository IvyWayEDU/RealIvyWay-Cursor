'use server';

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { setBankAccount, getBankAccount } from '@/lib/payouts/bank-account-storage';
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
    console.error('Error fetching bank account:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
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

    // Save bank account metadata (only stores bankName, last4, accountType - no sensitive data)
    const bankAccount = await setBankAccount(providerId, {
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(), // Used to extract last4, not stored
      accountType: accountType,
    });

    // Return bank account metadata (already contains only last4, no sensitive data)
    return Response.json({ success: true, bankAccount }, { status: 200 });
  } catch (error) {
    console.error('Error saving bank account:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

