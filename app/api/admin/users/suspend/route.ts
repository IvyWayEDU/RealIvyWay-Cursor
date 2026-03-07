import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { updateUser } from '@/lib/auth/storage';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const userId = String((body as any)?.userId ?? '').trim();
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    // Simple guard: don't allow self-suspension via this endpoint
    if (userId === authResult.session!.userId) {
      return NextResponse.json({ error: 'Cannot suspend yourself' }, { status: 400 });
    }

    const user = await updateUser(userId, { isSuspended: true, status: 'suspended' });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('[ADMIN USERS SUSPEND] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


