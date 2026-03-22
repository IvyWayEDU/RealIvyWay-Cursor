/**
 * Referral Credits Migration API
 * 
 * Migrates existing referral credits from 90-day to 31-day expiration.
 * Only updates credits that haven't expired yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { updateExistingCreditsTo31Days } from '@/lib/referrals/storage';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // Verify user session (admin only in production)
    const auth = await getAuthContext();
    if (auth.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }
    if (auth.status !== 'ok') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const session = auth.session;

    // Run migration
    const updatedCount = await updateExistingCreditsTo31Days();

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `Successfully updated ${updatedCount} referral credit(s) to 31-day expiration.`,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/referrals/migrate]' });
  }
}






