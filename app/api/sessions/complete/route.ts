import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { sessionId, actualStartTime, actualEndTime } = body;
    
    // Validate input
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    // Get session
    const sessionData = await getSessionById(sessionId);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Check access: provider can complete their own sessions, admin can complete any
    const canComplete = 
      session.roles.includes('admin') ||
      (session.roles.includes('provider') && sessionData.providerId === session.userId);
    
    if (!canComplete) {
      return NextResponse.json(
        { error: 'Forbidden: Only providers can complete sessions' },
        { status: 403 }
      );
    }
    
    // Check if session can be completed
    if (sessionData.status === 'completed' || sessionData.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Session cannot be completed' },
        { status: 400 }
      );
    }
    
    // CANONICAL RULES: completed ONLY when:
    // a) now >= scheduledStartTime + 10 minutes
    // b) providerJoinedAt exists
    const startMs = new Date(sessionData.scheduledStartTime).getTime();
    if (!Number.isFinite(startMs)) {
      return NextResponse.json({ error: 'Invalid session start time' }, { status: 400 });
    }
    const nowMs = Date.now();
    const tenMinutesAfterStartMs = startMs + 10 * 60 * 1000;
    const providerJoinedAt = (sessionData as any)?.providerJoinedAt;

    if (!(typeof providerJoinedAt === 'string' && providerJoinedAt.trim().length > 0)) {
      return NextResponse.json(
        { error: 'Session cannot be completed: provider has not joined Zoom' },
        { status: 400 }
      );
    }
    if (nowMs < tenMinutesAfterStartMs) {
      return NextResponse.json(
        { error: 'Session cannot be completed: must be at least 10 minutes after start time' },
        { status: 400 }
      );
    }

    console.log('[SESSION_COMPLETION_REQUESTED]', {
      sessionId,
      requestedBy: session.userId,
      role: session.roles,
    });

    // Complete session + (best-effort) credit earnings (idempotent).
    await markSessionCompletedWithEarnings(sessionId, 'api_complete', {
      completedAt: new Date(nowMs).toISOString(),
      actualStartTime: providerJoinedAt,
      actualEndTime: new Date(nowMs).toISOString(),
      completionReason: 'PROVIDER_JOINED',
      creditEarnings: true,
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ session: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/complete]' });
  }
}
