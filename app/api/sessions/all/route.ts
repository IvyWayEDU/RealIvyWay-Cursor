import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getSessions, getSessionsForUser } from '@/lib/sessions/storage';
import { resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';
import { handleApiError } from '@/lib/errorHandler';

export async function GET(request: NextRequest) {
  try {
    // Ensure session completion/no-show logic is evaluated before returning dashboard lists.
    await resolveUnifiedSessions('api_fetch');

    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const requestedRole = searchParams.get('role');

    if (session.roles.includes('admin') && !requestedRole) {
      const sessions = await getSessions();
      return NextResponse.json({ sessions });
    }

    let role: 'student' | 'provider';
    if (requestedRole === 'student' || requestedRole === 'provider') {
      if (!session.roles.includes(requestedRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      role = requestedRole;
    } else if (session.roles.includes('provider')) {
      role = 'provider';
    } else if (session.roles.includes('student')) {
      role = 'student';
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Per spec: do NOT filter by status in this endpoint.
    // Return ALL sessions for the user (role-scoped).
    const allSessions = await getSessions();
    const userSessions =
      role === 'student'
        ? allSessions.filter((s) => s.studentId === session.userId)
        : allSessions.filter((s) => s.providerId === session.userId);

    // Also return canonical buckets for dashboards that want explicit upcoming/completed lists
    // (without requiring UI-side filtering changes).
    const buckets = await getSessionsForUser(session.userId, role);
    return NextResponse.json({
      sessions: userSessions,
      upcoming: buckets.upcoming,
      completed: buckets.completed,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/all]' });
  }
}
