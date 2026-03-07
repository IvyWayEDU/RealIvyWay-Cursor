/**
 * DEV-ONLY: Earnings Preview Helper
 * 
 * This endpoint is ONLY available in development mode (NODE_ENV === "development").
 * It marks the most recent session as completed and credits provider earnings.
 * This is for previewing:
 * - Earnings snapshot
 * - Earnings list
 * - Earnings line graph
 * 
 * DO NOT USE IN PRODUCTION - This endpoint must not exist or run in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { updateSession } from '@/lib/sessions/storage';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';

export async function POST(request: NextRequest) {
  // STRICT: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    // Verify user session
    const auth = await getAuthContext();
    if (auth.status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    if (auth.status !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = auth.session;

    // Only providers can use this
    const isProvider = session.roles.includes('tutor') || session.roles.includes('counselor');
    if (!isProvider) {
      return NextResponse.json(
        { error: 'Only providers can use this endpoint' },
        { status: 403 }
      );
    }

    const providerId = session.userId;

    // Get all sessions for this provider, ordered by creation date (most recent first)
    const sessions = await getSessionsByProviderId(providerId);
    
    // Filter for sessions that are confirmed (not already completed/cancelled)
    const eligibleSessions = sessions.filter(s => 
      s.status === 'confirmed'
    ).sort((a, b) => {
      // Sort by createdAt descending (most recent first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (eligibleSessions.length === 0) {
      return NextResponse.json(
        { error: 'No eligible sessions found to complete' },
        { status: 404 }
      );
    }

    // Get the most recent session
    const mostRecentSession = eligibleSessions[0];

    // Check if already completed
    if (mostRecentSession.status === 'completed') {
      return NextResponse.json(
        { error: 'Session is already completed', sessionId: mostRecentSession.id },
        { status: 400 }
      );
    }

    // Mark session as completed and credit earnings
    const completedAt = new Date().toISOString();
    const earningsAmount = calculateProviderPayoutCentsFromSession(mostRecentSession);

    const updateSuccess = await updateSession(mostRecentSession.id, {
      status: 'completed',
      completedAt,
      actualEndTime: completedAt,
      actualStartTime: mostRecentSession.scheduledStartTime,
      payoutStatus: 'available',
      updatedAt: completedAt,
    });

    if (!updateSuccess) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    console.log('[DEV-ONLY] Earnings preview: Session marked as completed:', {
      sessionId: mostRecentSession.id,
      providerId,
      earningsAmount,
    });

    return NextResponse.json({
      success: true,
      sessionId: mostRecentSession.id,
      earningsAmount,
      completedAt,
    });
  } catch (error) {
    console.error('[DEV-ONLY] Error in earnings preview helper:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

