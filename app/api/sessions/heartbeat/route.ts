import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { resolveSessionAfterHeartbeat } from '@/lib/sessions/resolver';
// VALIDATION
import { validateRequestBody } from '@/lib/validation/utils';
import { heartbeatSchema } from '@/lib/validation/schemas';

/**
 * Heartbeat endpoint to track provider and student session attendance
 * Accepts: sessionId, role ("provider" or "student"), event ("join", "tick", or "leave")
 * 
 * SECURITY: Authentication and ownership validation required
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await auth.require();
    if (authResult.error) {
      console.warn('[SECURITY] Unauthenticated access attempt to /api/sessions/heartbeat');
      return authResult.error;
    }
    const session = authResult.session!;
    
    // Validate request body with schema
    const validationResult = await validateRequestBody(request, heartbeatSchema);
    if (!validationResult.success) {
      return validationResult.response;
    }
    const { sessionId, role, event } = validationResult.data;
    const eventType = event || 'tick';

    // Get the session
    const sessionData = await getSessionById(sessionId);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // SECURITY: IDOR protection - verify user owns the session (student or provider)
    // Use centralized ownership check
    const ownershipCheck = await auth.checkSessionOwnership(session, sessionId);
    if (ownershipCheck) {
      console.warn('[SECURITY] Unauthorized heartbeat access attempt:', {
        userId: session.userId,
        requestedRole: role,
        sessionId,
        sessionStudentId: sessionData.studentId,
        sessionProviderId: sessionData.providerId,
      });
      return ownershipCheck;
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const updateData: any = {};

    // Track before values for logging
    const beforeProviderSeconds = sessionData.providerAccumulatedSeconds || 0;
    const beforeStudentSeconds = sessionData.studentAccumulatedSeconds || 0;

    if (role === 'provider') {
      if (eventType === 'join') {
        // Set providerCurrentJoinTimestamp to now
        updateData.providerCurrentJoinTimestamp = nowISO;
        
        // If providerJoinedAt is missing, set it
        if (!sessionData.providerJoinedAt) {
          updateData.providerJoinedAt = nowISO;
        }

        // Persist explicit providerJoinTime for new completion rules (idempotent)
        if (!sessionData.providerJoinTime) {
          updateData.providerJoinTime = nowISO;
        }
        
        // Ensure providerAccumulatedSeconds is a number, default 0
        if (sessionData.providerAccumulatedSeconds === undefined) {
          updateData.providerAccumulatedSeconds = 0;
        }
        
        // IMPORTANT: Do not mutate status based on heartbeat.
        // Canonical lifecycle is enforced server-side via unified resolver using:
        // - status: confirmed -> (completed|flagged) only
        // - providerJoinedAt gate + startTime+10 minutes rule
      } else if (eventType === 'tick') {
        // Calculate delta from providerCurrentJoinTimestamp
        if (sessionData.providerCurrentJoinTimestamp) {
          const currentJoinTime = new Date(sessionData.providerCurrentJoinTimestamp);
          const deltaSeconds = Math.floor((now.getTime() - currentJoinTime.getTime()) / 1000);
          
          if (deltaSeconds > 0) {
            const currentAccumulated = sessionData.providerAccumulatedSeconds || 0;
            updateData.providerAccumulatedSeconds = currentAccumulated + deltaSeconds;
            updateData.providerCurrentJoinTimestamp = nowISO; // Update timestamp
          }
        } else {
          // No current join timestamp, set it now
          updateData.providerCurrentJoinTimestamp = nowISO;
        }
      } else if (eventType === 'leave') {
        // Do one final tick update first
        if (sessionData.providerCurrentJoinTimestamp) {
          const currentJoinTime = new Date(sessionData.providerCurrentJoinTimestamp);
          const deltaSeconds = Math.floor((now.getTime() - currentJoinTime.getTime()) / 1000);
          
          if (deltaSeconds > 0) {
            const currentAccumulated = sessionData.providerAccumulatedSeconds || 0;
            updateData.providerAccumulatedSeconds = currentAccumulated + deltaSeconds;
          }
        }
        
        // Clear providerCurrentJoinTimestamp
        updateData.providerCurrentJoinTimestamp = undefined;
      }
    } else if (role === 'student') {
      if (eventType === 'join') {
        // Set studentCurrentJoinTimestamp to now
        updateData.studentCurrentJoinTimestamp = nowISO;
        
        // If studentJoinedAt is missing, set it
        if (!sessionData.studentJoinedAt) {
          updateData.studentJoinedAt = nowISO;
        }

        // Persist explicit studentJoinTime for new completion rules (idempotent)
        if (!sessionData.studentJoinTime) {
          updateData.studentJoinTime = nowISO;
        }
        
        // Ensure studentAccumulatedSeconds is a number, default 0
        if (sessionData.studentAccumulatedSeconds === undefined) {
          updateData.studentAccumulatedSeconds = 0;
        }
      } else if (eventType === 'tick') {
        // Calculate delta from studentCurrentJoinTimestamp
        if (sessionData.studentCurrentJoinTimestamp) {
          const currentJoinTime = new Date(sessionData.studentCurrentJoinTimestamp);
          const deltaSeconds = Math.floor((now.getTime() - currentJoinTime.getTime()) / 1000);
          
          if (deltaSeconds > 0) {
            const currentAccumulated = sessionData.studentAccumulatedSeconds || 0;
            updateData.studentAccumulatedSeconds = currentAccumulated + deltaSeconds;
            updateData.studentCurrentJoinTimestamp = nowISO; // Update timestamp
          }
        } else {
          // No current join timestamp, set it now
          updateData.studentCurrentJoinTimestamp = nowISO;
        }
      } else if (eventType === 'leave') {
        // Do one final tick update first
        if (sessionData.studentCurrentJoinTimestamp) {
          const currentJoinTime = new Date(sessionData.studentCurrentJoinTimestamp);
          const deltaSeconds = Math.floor((now.getTime() - currentJoinTime.getTime()) / 1000);
          
          if (deltaSeconds > 0) {
            const currentAccumulated = sessionData.studentAccumulatedSeconds || 0;
            updateData.studentAccumulatedSeconds = currentAccumulated + deltaSeconds;
          }
        }
        
        // Clear studentCurrentJoinTimestamp
        updateData.studentCurrentJoinTimestamp = undefined;
      }
    }

    // Update session
    updateData.updatedAt = nowISO;
    const updateSuccess = await updateSession(sessionId, updateData);

    if (!updateSuccess) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Re-read session after update
    const updatedSession = await getSessionById(sessionId);
    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Failed to retrieve updated session' },
        { status: 500 }
      );
    }

    // Run resolution after heartbeat update
    await resolveSessionAfterHeartbeat(sessionId);

    // Re-read session after resolution to get final state
    const resolvedSession = await getSessionById(sessionId);
    if (!resolvedSession) {
      return NextResponse.json(
        { error: 'Failed to retrieve resolved session' },
        { status: 500 }
      );
    }

    // Log heartbeat
    const afterProviderSeconds = resolvedSession.providerAccumulatedSeconds || 0;
    const afterStudentSeconds = resolvedSession.studentAccumulatedSeconds || 0;
    console.log(`[HEARTBEAT] ${sessionId} ${role} ${eventType} beforeProvider:${beforeProviderSeconds} afterProvider:${afterProviderSeconds} beforeStudent:${beforeStudentSeconds} afterStudent:${afterStudentSeconds} status:${resolvedSession.status} payoutStatus:${resolvedSession.payoutStatus || 'none'}`);

    return NextResponse.json({ 
      ok: true,
      sessionId,
      providerAccumulatedSeconds: afterProviderSeconds,
      studentAccumulatedSeconds: afterStudentSeconds,
      status: resolvedSession.status,
      payoutStatus: resolvedSession.payoutStatus || 'none',
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process heartbeat',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

