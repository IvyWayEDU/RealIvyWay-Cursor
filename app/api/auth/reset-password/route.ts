import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { hashPassword } from '@/lib/auth/crypto';
import { hashPasswordResetToken } from '@/lib/auth/passwordReset';
import { consumePasswordResetToken } from '@/lib/auth/passwordResetTokens';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { getServerSession } from '@/lib/auth/getServerSession';

function uidKeySuffix(uid: string): string {
  const u = String(uid || '').trim();
  if (!u) return 'uid:none';
  const h = crypto.createHash('sha256').update(u, 'utf8').digest('hex').slice(0, 16);
  return `uid:${h}`;
}

export async function POST(request: NextRequest) {
  try {
    const existingSession = await getServerSession().catch(() => null);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const uid = typeof body?.uid === 'string' ? body.uid : '';
    const token = typeof body?.token === 'string' ? body.token : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

    const rl = enforceRateLimit(request, {
      session: existingSession,
      endpoint: '/api/auth/reset-password',
      max: 10,
      windowMs: 10 * 60_000,
      keySuffix: uidKeySuffix(uid),
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    if (!uid || !token) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    const user = await getUserById(uid);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const tokenHash = hashPasswordResetToken(token);
    const nowIso = new Date().toISOString();
    const consumed = await consumePasswordResetToken({ userId: uid, tokenHash, nowIso });
    if (!consumed) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await updateUser(uid, { passwordHash });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/auth/reset-password]' });
  }
}

