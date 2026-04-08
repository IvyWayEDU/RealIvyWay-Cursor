import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New password and confirmation do not match' }, { status: 400 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    await updateUser(session.userId, { passwordHash });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/auth/change-password]' });
  }
}

