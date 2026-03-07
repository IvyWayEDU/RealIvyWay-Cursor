import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';

type SimulationType = 'provider_no_show' | 'student_no_show' | 'normal';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    // Hide this feature in production builds.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const authResult = await auth.require();
  if (authResult.error) return authResult.error;
  const session = authResult.session!;

  const isProvider = Array.isArray(session.roles) && session.roles.includes('provider');
  const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');
  if (!isProvider && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = String((body as any)?.sessionId || '').trim();
  const simulationType = String((body as any)?.simulationType || '').trim() as SimulationType;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }
  if (!['provider_no_show', 'student_no_show', 'normal'].includes(simulationType)) {
    return NextResponse.json({ error: 'Invalid simulationType' }, { status: 400 });
  }

  const existing = await getSessionById(sessionId);
  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Providers can only finalize their own sessions. Admin can finalize any.
  if (!isAdmin && existing.providerId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (existing.status === 'cancelled') {
    return NextResponse.json({ error: 'Session cannot be finalized' }, { status: 400 });
  }

  const nowISO = new Date().toISOString();

  const baseArgs = {
    completedAt: nowISO,
    actualStartTime: (existing as any)?.actualStartTime || (existing as any)?.providerJoinedAt || undefined,
    actualEndTime: nowISO,
    completionReason: 'DEV_FINALIZE_SESSION',
  } as const;

  if (simulationType === 'provider_no_show') {
    await markSessionCompletedWithEarnings(sessionId, 'dev_finalize_session', {
      ...baseArgs,
      status: 'completed_no_show_provider',
      providerEarned: false,
      flagNoShowProvider: true,
      flagNoShowStudent: false,
      noShowParty: 'provider',
      creditEarnings: false,
      flag: 'provider_no_show',
    });
  } else if (simulationType === 'student_no_show') {
    await markSessionCompletedWithEarnings(sessionId, 'dev_finalize_session', {
      ...baseArgs,
      status: 'completed_no_show_student',
      providerEarned: true,
      flagNoShowProvider: false,
      flagNoShowStudent: true,
      noShowParty: 'student',
      creditEarnings: true,
      flag: 'student_no_show',
    });
  } else {
    await markSessionCompletedWithEarnings(sessionId, 'dev_finalize_session', {
      ...baseArgs,
      status: 'completed',
      providerEarned: true,
      flagNoShowProvider: false,
      flagNoShowStudent: false,
      creditEarnings: true,
    });
  }

  const updated = await getSessionById(sessionId);
  return NextResponse.json({ session: updated });
}


