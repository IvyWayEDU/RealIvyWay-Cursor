import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser } from '@/lib/auth/storage';

/**
 * DEV-ONLY: Promote a user to admin by userId.
 *
 * POST /api/dev/make-admin
 * Body: { userId: string }
 *
 * SECURITY: This endpoint is intentionally dev-only to allow bootstrapping an admin.
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = String((body as any)?.userId ?? '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin role is exclusive in this codebase.
    const updated = await updateUser(userId, { roles: ['admin'] });
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('[DEV MAKE ADMIN] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


