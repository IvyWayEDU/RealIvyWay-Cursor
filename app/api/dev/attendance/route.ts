import { NextRequest, NextResponse } from 'next/server';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { trackProviderJoinUnified, resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';
import { handleApiError } from '@/lib/errorHandler';

/**
 * DEV-ONLY: Simulate attendance events for testing
 * 
 * This route allows simulating provider/student join and leave events
 * without requiring actual Zoom webhooks.
 * 
 * Guarded by NODE_ENV !== 'production'
 * 
 * POST /api/dev/attendance
 * Body: { sessionId: string, action: 'provider_join' | 'provider_leave' | 'student_join' | 'student_leave' }
 */
export async function POST(request: NextRequest) {
  // Guard: Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { sessionId, action } = body;

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId and action' },
        { status: 400 }
      );
    }

    if (!['provider_join', 'provider_leave', 'student_join', 'student_leave'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: provider_join, provider_leave, student_join, student_leave' },
        { status: 400 }
      );
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const nowISO = now.toISOString();

    if (action === 'provider_join') {
      // Use unified resolver to track provider join
      const result = await trackProviderJoinUnified(sessionId, now);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to track provider join' },
          { status: 400 }
        );
      }

      console.log('[ATTENDANCE] DEV: Provider join simulated:', {
        sessionId,
        joinedWithinWindow: result.joinedWithinWindow,
      });

      return NextResponse.json({ 
        success: true, 
        action: 'provider_join', 
        timestamp: nowISO,
        joinedWithinWindow: result.joinedWithinWindow,
      });
    }

    if (action === 'provider_leave') {
      if (!session.providerCurrentJoinTimestamp) {
        return NextResponse.json(
          { error: 'Provider is not currently joined' },
          { status: 400 }
        );
      }

      const joinTime = new Date(session.providerCurrentJoinTimestamp);
      const durationSeconds = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
      const currentAccumulated = session.providerAccumulatedSeconds || 0;
      const newAccumulatedSeconds = currentAccumulated + durationSeconds;

      await updateSession(sessionId, {
        providerCurrentJoinTimestamp: undefined,
        providerAccumulatedSeconds: newAccumulatedSeconds,
        providerLeaveTime: nowISO,
        updatedAt: nowISO,
      });

      console.log('[ATTENDANCE] DEV: Provider leave simulated:', {
        sessionId,
        durationSeconds,
        accumulatedSeconds: newAccumulatedSeconds,
      });

      // Trigger session resolution
      await resolveUnifiedSessions('webhook');

      return NextResponse.json({
        success: true,
        action: 'provider_leave',
        durationSeconds,
        accumulatedSeconds: newAccumulatedSeconds,
        timestamp: nowISO,
      });
    }

    if (action === 'student_join') {
      const updateData: any = {
        updatedAt: nowISO,
      };

      // Set studentJoinedAt if not already set (first join)
      if (!session.studentJoinedAt) {
        updateData.studentJoinedAt = nowISO;
      }

      // Set studentCurrentJoinTimestamp if not currently joined
      if (!session.studentCurrentJoinTimestamp) {
        updateData.studentCurrentJoinTimestamp = nowISO;
      }

      // Initialize studentAccumulatedSeconds if not set
      if (session.studentAccumulatedSeconds === undefined) {
        updateData.studentAccumulatedSeconds = 0;
      }

      await updateSession(sessionId, updateData);

      console.log('[ATTENDANCE] DEV: Student join simulated:', {
        sessionId,
        studentJoinedAt: updateData.studentJoinedAt,
        studentCurrentJoinTimestamp: updateData.studentCurrentJoinTimestamp,
      });

      return NextResponse.json({ success: true, action: 'student_join', timestamp: nowISO });
    }

    if (action === 'student_leave') {
      if (!session.studentCurrentJoinTimestamp) {
        return NextResponse.json(
          { error: 'Student is not currently joined' },
          { status: 400 }
        );
      }

      const joinTime = new Date(session.studentCurrentJoinTimestamp);
      const durationSeconds = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
      const currentAccumulated = session.studentAccumulatedSeconds || 0;
      const newAccumulatedSeconds = currentAccumulated + durationSeconds;

      await updateSession(sessionId, {
        studentCurrentJoinTimestamp: undefined,
        studentAccumulatedSeconds: newAccumulatedSeconds,
        updatedAt: nowISO,
      });

      console.log('[ATTENDANCE] DEV: Student leave simulated:', {
        sessionId,
        durationSeconds,
        accumulatedSeconds: newAccumulatedSeconds,
      });

      return NextResponse.json({
        success: true,
        action: 'student_leave',
        durationSeconds,
        accumulatedSeconds: newAccumulatedSeconds,
        timestamp: nowISO,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/dev/attendance]' });
  }
}

