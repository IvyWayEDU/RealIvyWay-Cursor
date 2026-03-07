import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getSessionsForUser } from '@/lib/sessions/storage';
import { resolveUnifiedSessions } from '@/lib/sessions/unified-resolver';

export async function GET(request: NextRequest) {
  try {
    // Ensure session completion/no-show logic is evaluated before returning dashboard lists.
    await resolveUnifiedSessions('api_fetch');

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    const requestedRole = request.nextUrl.searchParams.get('role');

    // Determine role (allow explicit override via ?role=provider|student, validated against user's roles)
    let role: 'student' | 'provider';
    if (requestedRole === 'student' || requestedRole === 'provider') {
      if (!session.roles.includes(requestedRole)) {
        return NextResponse.json(
          { error: 'Forbidden: Role not permitted for current user' },
          { status: 403 }
        );
      }
      role = requestedRole;
    } else if (session.roles.includes('provider')) {
      // Prefer provider if user has provider role; dashboards can still explicitly request student.
      role = 'provider';
    } else if (session.roles.includes('student')) {
      role = 'student';
    } else {
      return NextResponse.json(
        { error: 'Forbidden: Student or provider role required' },
        { status: 403 }
      );
    }

    const currentUser = { id: session.userId };
    const { upcoming } = await getSessionsForUser(currentUser.id, role);
    const sessions = upcoming;
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
