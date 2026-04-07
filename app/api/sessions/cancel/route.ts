import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getSessionById, cancelSession, updateSession } from '@/lib/sessions/storage';
import { CancellationReason } from '@/lib/models/types';
import { handleApiError } from '@/lib/errorHandler';
import { sendCancellationEmailsForSession } from '@/lib/email/transactional';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { sessionId, reason, note } = body;
    
    // Validate input
    if (!sessionId || !reason) {
      return NextResponse.json(
        { error: 'Session ID and cancellation reason are required' },
        { status: 400 }
      );
    }
    
    // Validate reason
    const validReasons: CancellationReason[] = ['student-request', 'provider-request', 'admin-request', 'system-error', 'other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid cancellation reason' },
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
    
    // Check access: student can cancel their own, provider can cancel their own, admin can cancel any
    const canCancel = 
      session.roles.includes('admin') ||
      (session.roles.includes('student') && sessionData.studentId === session.userId) ||
      (session.roles.includes('provider') && sessionData.providerId === session.userId);
    
    if (!canCancel) {
      return NextResponse.json(
        { error: 'Forbidden: You can only cancel your own sessions' },
        { status: 403 }
      );
    }
    
    // Check if session can be cancelled
    if (sessionData.status === 'cancelled' || sessionData.status === 'cancelled-late' || sessionData.status === 'completed') {
      return NextResponse.json(
        { error: 'Session cannot be cancelled' },
        { status: 400 }
      );
    }
    
    // Cancel session
    const cancelled = await cancelSession(sessionId, session.userId, reason, note);

    // Transactional email: cancellation (idempotent per-session)
    if (cancelled) {
      try {
        const alreadyStudent = Boolean((cancelled as any)?.cancellationEmailStudentSentAt);
        const alreadyProvider = Boolean((cancelled as any)?.cancellationEmailProviderSentAt);
        if (!alreadyStudent || !alreadyProvider) {
          const sendResult = await sendCancellationEmailsForSession(cancelled as any);
          const nowISO = new Date().toISOString();
          await updateSession(sessionId, {
            cancellationEmailStudentSentAt: sendResult.studentEmailSent ? nowISO : (cancelled as any)?.cancellationEmailStudentSentAt,
            cancellationEmailProviderSentAt: sendResult.providerEmailSent ? nowISO : (cancelled as any)?.cancellationEmailProviderSentAt,
            cancellationEmailsSentAt:
              sendResult.studentEmailSent && sendResult.providerEmailSent ? nowISO : (cancelled as any)?.cancellationEmailsSentAt,
            updatedAt: nowISO,
          } as any);
        }
      } catch (e) {
        console.warn('[email] cancellation send failed (non-blocking)', {
          sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    
    return NextResponse.json({ session: cancelled });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/cancel]' });
  }
}
