import { NextRequest, NextResponse } from 'next/server';
import { getSessions, getSessionById, updateSession } from '@/lib/sessions/storage';
import { getUserById } from '@/lib/auth/storage';
import { trackProviderJoinUnified, resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';

// Provider join grace window after scheduled start (10 minutes)
const GRACE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Zoom Webhook Handler
 * 
 * Handles Zoom meeting events for session completion:
 * - meeting.started: Meeting has started
 * - meeting.participant_joined: Participant joined the meeting
 * - meeting.ended: Meeting has ended
 * 
 * Session completion logic (unified):
 * - Provider join is recorded as providerJoinedAt (first join)
 * - At startTime + 10 minutes:
 *   - If providerJoinedAt exists: mark completed (eligible for payout)
 *   - If providerJoinedAt does NOT exist: mark flagged (no payout)
 * - Student join does NOT affect completion/payout
 */

interface ZoomWebhookEvent {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      id: string; // Meeting ID
      uuid: string;
      host_id?: string;
      topic?: string;
      start_time?: string;
      duration?: number;
      participant?: {
        user_id?: string;
        user_name?: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
      participants?: Array<{
        user_id?: string;
        user_name?: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      }>;
    };
  };
}

/**
 * Find session by Zoom meeting ID
 */
async function findSessionByZoomMeetingId(zoomMeetingId: string) {
  const allSessions = await getSessions();
  return allSessions.find(session => session.zoomMeetingId === zoomMeetingId) || null;
}

/**
 * Check if user is provider for a session
 * Preferred: Compare to zoomHostEmail stored on session
 * Fallback: Compare to provider email from user database
 */
async function isProviderForSession(userEmail: string, session: { providerId: string; zoomHostEmail?: string }): Promise<boolean> {
  // Preferred method: Check zoomHostEmail stored on session
  if (session.zoomHostEmail) {
    return session.zoomHostEmail.toLowerCase() === userEmail.toLowerCase();
  }
  
  // Fallback: Compare to provider email from user database
  const provider = await getUserById(session.providerId);
  if (!provider) return false;
  return provider.email.toLowerCase() === userEmail.toLowerCase();
}

/**
 * Check if user is student for a session
 */
async function isStudentForSession(userEmail: string, sessionStudentId: string): Promise<boolean> {
  const student = await getUserById(sessionStudentId);
  if (!student) return false;
  return student.email.toLowerCase() === userEmail.toLowerCase();
}

/**
 * Handle meeting.participant_left event
 * Provider leave is tracked but does not affect completion logic
 * (Completion is based only on provider joining within the 10-minute window)
 */
async function handleParticipantLeft(event: ZoomWebhookEvent) {
  const meetingId = event.payload.object.id;
  const participant = event.payload.object.participant;
  
  if (!participant || !participant.email || !participant.leave_time) {
    return; // Missing participant data
  }

  const session = await findSessionByZoomMeetingId(meetingId);
  if (!session) {
    console.log('[ATTENDANCE] Participant left but session not found:', { meetingId, participantEmail: participant.email });
    return;
  }

  // Check if participant is provider
  const isProvider = await isProviderForSession(participant.email, session);
  if (isProvider) {
    console.log('[ATTENDANCE] Provider leave event:', {
      sessionId: session.id,
      zoomMeetingId: meetingId,
      participantEmail: participant.email,
      leaveTime: participant.leave_time,
    });
    
    // Note: Provider leave does not affect completion logic
    // Completion is based only on provider joining within the 10-minute window
    // We still log the leave event for tracking purposes
    
    // Trigger session resolution to check if session should be completed
    await resolveUnifiedSessions('webhook');
  } else {
    // Handle student leave (track but don't affect payout)
    const isStudent = await isStudentForSession(participant.email, session.studentId);
    if (isStudent) {
      console.log('[ATTENDANCE] Student leave event:', {
        sessionId: session.id,
        leaveTime: participant.leave_time,
      });
      // Student leave does not affect payout eligibility
    }
  }
}

/**
 * Handle meeting.participant_joined event
 */
async function handleParticipantJoined(event: ZoomWebhookEvent) {
  const meetingId = event.payload.object.id;
  const participant = event.payload.object.participant;
  
  if (!participant || !participant.email || !participant.join_time) {
    return; // Missing participant data
  }

  const session = await findSessionByZoomMeetingId(meetingId);
  if (!session) {
    console.log('Zoom participant joined but session not found:', { meetingId, participantEmail: participant.email });
    return;
  }

  const joinTime = new Date(participant.join_time);
  const sessionStartTime = new Date(session.scheduledStartTime);
  const graceWindowEnd = new Date(sessionStartTime.getTime() + GRACE_WINDOW_MS);

  // Check if participant is provider (use zoomHostEmail if available, fallback to provider email lookup)
  const isProvider = await isProviderForSession(participant.email, session);
  if (isProvider) {
    console.log('[ATTENDANCE] Provider join event:', {
      sessionId: session.id,
      zoomMeetingId: meetingId,
      participantEmail: participant.email,
      joinTime: participant.join_time,
    });
    console.log('[ZOOM_JOIN]', { sessionId: session.id, role: 'provider', joinTime: participant.join_time });
    console.log('[PROVIDER_ZOOM_JOIN]', {
      sessionId: session.id,
      zoomMeetingId: meetingId,
      participantEmail: participant.email,
      source: 'zoom_webhook',
    });
    
    // Track provider join using unified resolver
    // This will set providerJoinedAt if join is within the 10-minute window
    try {
      const result = await trackProviderJoinUnified(session.id, joinTime);
      if (result.success) {
        console.log('[ATTENDANCE] Provider join recorded:', {
          sessionId: session.id,
          joinedWithinWindow: result.joinedWithinWindow,
        });
      } else {
        console.log('[ATTENDANCE] Provider join failed:', {
          sessionId: session.id,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('[ATTENDANCE] Error recording provider join:', error);
    }
    
    return; // Provider handled, return
  }

  // Check if participant is student
  const isStudent = await isStudentForSession(participant.email, session.studentId);
  if (isStudent) {
    const nowISO = joinTime.toISOString();
    const updateData: any = {
      updatedAt: nowISO,
    };
    
    // Set studentJoinedAt if not already set (first join)
    if (!session.studentJoinedAt) {
      updateData.studentJoinedAt = nowISO;
    }

    // Persist explicit studentJoinTime for new completion rules (idempotent)
    if (!session.studentJoinTime) {
      updateData.studentJoinTime = nowISO;
    }
    
    // Set studentCurrentJoinTimestamp if not currently joined
    if (!session.studentCurrentJoinTimestamp) {
      updateData.studentCurrentJoinTimestamp = nowISO;
    }
    
    // Initialize studentAccumulatedSeconds if not set
    if (session.studentAccumulatedSeconds === undefined) {
      updateData.studentAccumulatedSeconds = 0;
    }
    
    await updateSession(session.id, updateData);
    
    console.log('[ATTENDANCE] Student join recorded:', {
      sessionId: session.id,
      studentJoinedAt: updateData.studentJoinedAt,
      studentCurrentJoinTimestamp: updateData.studentCurrentJoinTimestamp,
    });
    console.log('[ZOOM_JOIN]', { sessionId: session.id, role: 'student', joinTime: nowISO });
  }
}

/**
 * Handle meeting.ended event
 * Triggers session resolution using unified resolver
 */
async function handleMeetingEnded(event: ZoomWebhookEvent) {
  const meetingId = event.payload.object.id;

  const session = await findSessionByZoomMeetingId(meetingId);
  if (!session) {
    console.log('[ATTENDANCE] Meeting ended but session not found:', { meetingId });
    return;
  }

  // Check if session is already resolved
  const resolvedStatuses = ['completed', 'flagged', 'cancelled'];
  if (resolvedStatuses.includes(session.status)) {
    console.log('[ATTENDANCE] Session already resolved, skipping meeting ended handler:', {
      sessionId: session.id,
      status: session.status,
    });
    return;
  }

  // Trigger unified resolver to check if session should be completed
  await resolveUnifiedSessions('webhook');
}

/**
 * Handle meeting.started event (optional, for logging)
 */
async function handleMeetingStarted(event: ZoomWebhookEvent) {
  const meetingId = event.payload.object.id;
  const session = await findSessionByZoomMeetingId(meetingId);
  
  if (session) {
    console.log('Zoom meeting started:', {
      sessionId: session.id,
      zoomMeetingId: meetingId,
      scheduledStartTime: session.scheduledStartTime,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ZoomWebhookEvent;

    // Verify webhook event type
    const eventType = body.event;

    switch (eventType) {
      case 'meeting.started':
        await handleMeetingStarted(body);
        break;
      case 'meeting.participant_joined':
        await handleParticipantJoined(body);
        break;
      case 'meeting.participant_left':
        await handleParticipantLeft(body);
        break;
      case 'meeting.ended':
        await handleMeetingEnded(body);
        break;
      default:
        // Log but don't error on unknown event types
        console.log('[ZOOM] Unhandled webhook event:', eventType);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    // Always return 200 to prevent Zoom from retrying
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

