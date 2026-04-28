import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getUserByEmail, getUserById, updateUser } from '@/lib/auth/storage';
import { handleApiError } from '@/lib/errorHandler';
import type { UserRole } from '@/lib/auth/types';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const userId = String((body as any)?.userId ?? '').trim();
    const email = String((body as any)?.email ?? '').trim().toLowerCase();

    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }

    const user = userId ? await getUserById(userId) : await getUserByEmail(email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const roles = Array.isArray((user as any).roles) ? ((user as any).roles as UserRole[]) : ([] as UserRole[]);
    const nextRoles = Array.from(new Set([...roles, 'admin'])) as UserRole[];

    const updated = await updateUser(user.id, { roles: nextRoles as any });
    if (!updated) return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/users/promote-admin]' });
  }
}

