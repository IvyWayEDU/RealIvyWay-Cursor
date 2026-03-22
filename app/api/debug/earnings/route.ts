/**
 * Debug Endpoint: Earnings
 * 
 * GET /api/debug/earnings?providerId=...
 * 
 * Returns earnings information for a provider.
 * Only available in non-production environments.
 * 
 * SECURITY FIX: Authentication and authorization required even in debug mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import { handleApiError } from '@/lib/errorHandler';

/**
 * SECURITY: Authentication required, ownership or admin access required
 */
export async function GET(request: NextRequest) {
  // Guard: Only allow in non-production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    // SECURITY: Require authentication even in debug mode
    const authResult = await auth.require();
    if (authResult.error) {
      console.warn('[SECURITY] Unauthenticated access attempt to /api/debug/earnings');
      return authResult.error;
    }
    const session = authResult.session!;
    
    // SECURITY: Only allow admin or the provider themselves to view earnings
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get('providerId');
    
    if (!providerId) {
      return NextResponse.json(
        { error: 'providerId query parameter is required' },
        { status: 400 }
      );
    }
    
    // SECURITY: Check ownership or admin access (IDOR protection)
    const { isAdmin } = await import('@/lib/auth/authorization');
    if (!isAdmin(session) && session.userId !== providerId) {
      console.warn('[SECURITY] Unauthorized earnings access attempt:', {
        userId: session.userId,
        requestedProviderId: providerId,
        roles: session.roles,
      });
      return NextResponse.json(
        { error: 'Forbidden: You can only view your own earnings' },
        { status: 403 }
      );
    }

    const sessions = await getSessionsByProviderId(providerId);
    const completedSessions = sessions
      .filter((s) => s.providerId === providerId && s.status === 'completed')
      .map((s) => ({
        sessionId: s.id,
        completedAt: s.completedAt || s.actualEndTime || s.scheduledEndTime,
        payoutStatus: s.payoutStatus || 'available',
        amountCents: calculateProviderPayoutCentsFromSession(s),
      }))
      .sort((a, b) => new Date(b.completedAt || '').getTime() - new Date(a.completedAt || '').getTime());

    const totalEarnedCents = completedSessions.reduce((sum, s) => sum + s.amountCents, 0);
    const latestSessions = completedSessions.slice(0, 5);

    return NextResponse.json({
      providerId,
      totalEarnedCents,
      completedCount: completedSessions.length,
      latestSessions,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/debug/earnings]' });
  }
}

