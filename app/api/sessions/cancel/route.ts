import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getSessionById, cancelSession } from '@/lib/sessions/storage';
import { CancellationReason } from '@/lib/models/types';
import { handleApiError } from '@/lib/errorHandler';

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
    
    return NextResponse.json({ session: cancelled });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/cancel]' });
  }
}
