import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserByEmail } from '@/lib/auth/storage';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_EXPIRES_MS,
} from '@/lib/auth/passwordReset';
import { createPasswordResetTokenRow } from '@/lib/auth/passwordResetTokens';
import { sendPasswordResetEmail } from '@/lib/email/transactional';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';
import { getServerSession } from '@/lib/auth/getServerSession';

function baseUrlFromRequest(request: NextRequest): string {
  return process.env.BASE_URL || new URL(request.url).origin;
}

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  return undefined;
}

function emailKeySuffix(email: string): string {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return 'email:none';
  const h = crypto.createHash('sha256').update(e, 'utf8').digest('hex').slice(0, 16);
  return `email:${h}`;
}

export async function POST(request: NextRequest) {
  // SECURITY: prevent account enumeration by always returning success.
  // Only rate limiting returns a distinct response.
  try {
    const existingSession = await getServerSession().catch(() => null);

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const email = typeof body?.email === 'string' ? body.email : '';

    const rl = enforceRateLimit(request, {
      session: existingSession,
      endpoint: '/api/auth/forgot-password',
      max: 5,
      windowMs: 10 * 60_000,
      keySuffix: emailKeySuffix(email),
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const user = await getUserByEmail(normalizedEmail);
    if (user) {
      const token = generatePasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);
      const expiresAtIso = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS).toISOString();

      await createPasswordResetTokenRow({
        userId: user.id,
        tokenHash,
        expiresAtIso,
        requestIp: getClientIp(request),
      });

      const resetUrl = `${baseUrlFromRequest(request)}/auth/reset-password?uid=${encodeURIComponent(
        user.id
      )}&token=${encodeURIComponent(token)}`;

      // Best-effort email send: never reveal existence in API response.
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: Math.round(PASSWORD_RESET_EXPIRES_MS / 60_000),
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[api/auth/forgot-password]', error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

