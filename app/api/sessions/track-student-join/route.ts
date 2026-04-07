import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';
import { handleApiError } from '@/lib/errorHandler';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { sessionTrackingSchema } from '@/lib/validation/schemas';

/**
 * Track when student joins Zoom meeting
 * Called when student clicks Join Session button
 * 
 * SECURITY: Authentication and student role required, ownership verified
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and student role
    const authResult = await auth.requireStudent();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    // Validate request body with schema
    const validationResult = await validateRequestBody(request, sessionTrackingSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { sessionId } = validationResult.data;

    // SECURITY: Verify session ownership (IDOR protection)
    const ownershipCheck = await auth.checkSessionOwnership(session, sessionId);
    if (ownershipCheck) return ownershipCheck;

    // Get the session (already verified ownership above)
    const sessionData = await getSessionById(sessionId);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if student already joined (idempotent check)
    if (sessionData.studentJoinedAt) {
      return NextResponse.json({ success: true }); // Already tracked, no error
    }

    const now = new Date().toISOString();
    const startTime = new Date(sessionData.scheduledStartTime);
    const tenMinutesAfterStart = new Date(startTime.getTime() + 10 * 60 * 1000);
    const nowDate = new Date();

    // Check if student joined within 10 minutes after start (grace period)
    const joinedWithinGracePeriod = nowDate <= tenMinutesAfterStart;

    // Update session with student joined timestamp
    const updateSuccess = await updateSession(sessionId, {
      studentJoinedAt: now,
      updatedAt: now,
      studentAttendance: {
        ...(sessionData as any)?.studentAttendance,
        joinedWithin10Min: joinedWithinGracePeriod,
        joinedAt: now,
      },
    });
    
    console.log('[SESSION LIFECYCLE] Student joined - set studentJoinedAt:', {
      sessionId,
      studentId: sessionData.studentId,
      studentJoinedAt: now,
      joinedWithinGracePeriod,
    });

    if (!updateSuccess) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Ensure status transitions (completed/no-show) are persisted promptly after join evidence.
    await resolveUnifiedSessions('api_fetch');

    console.log('Student joined tracked:', {
      sessionId,
      studentId: sessionData.studentId,
      joinedAt: now,
      joinedWithinGracePeriod,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/track-student-join]' });
  }
}



