import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getPlatformFeesConfig, updatePlatformFee } from '@/lib/platform-fees/storage';
import { PlatformFee } from '@/lib/platform-fees/types';
import { handleApiError } from '@/lib/errorHandler';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { platformFeeUpdateSchema } from '@/lib/validation/schemas';

/**
 * GET /api/platform-fees
 * Get all platform fees (admin only)
 * 
 * SECURITY: Admin access required
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin role
    const authResult = await auth.requireAdmin();
    if (authResult.error) {
      console.warn('[SECURITY] Admin access denied:', { userId: authResult.session?.userId, roles: authResult.session?.roles });
      return authResult.error;
    }
    const session = authResult.session!;

    const config = await getPlatformFeesConfig();
    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/platform-fees] GET' });
  }
}

/**
 * PUT /api/platform-fees
 * Update platform fee (admin only)
 * 
 * SECURITY: Admin access required
 */
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin role
    const authResult = await auth.requireAdmin();
    if (authResult.error) {
      console.warn('[SECURITY] Admin access denied:', { userId: authResult.session?.userId, roles: authResult.session?.roles });
      return authResult.error;
    }
    const session = authResult.session!;

    // Validate request body with schema
    const validationResult = await validateRequestBody(request, platformFeeUpdateSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { feeId, calculationType, amountCents, percentage } = validationResult.data;

    const updates: Partial<PlatformFee> = {
      calculationType,
      ...(calculationType === 'flat' 
        ? { amountCents, percentage: 0 }
        : { percentage, amountCents: 0 }
      ),
    };

    const success = await updatePlatformFee(feeId, updates, session.userId);

    if (!success) {
      return NextResponse.json(
        { error: 'Platform fee not found' },
        { status: 404 }
      );
    }

    const config = await getPlatformFeesConfig();
    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/platform-fees] PUT' });
  }
}




