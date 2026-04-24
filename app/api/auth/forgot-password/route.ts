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
  // Canonical base URL for links in production emails.
  // Requirements: never use preview deployment domains or localhost in production sends.
  const canonical = 'https://ivywayedu.com';

  const explicit = (process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  const normalize = (raw: string) => raw.replace(/\/+$/, '');
  const isDev = process.env.NODE_ENV !== 'production';
  if (explicit && isDev) return normalize(explicit);

  const xfProto = (request.headers.get('x-forwarded-proto') || '').split(',')[0]?.trim();
  const xfHost = (request.headers.get('x-forwarded-host') || '').split(',')[0]?.trim();
  const host = (request.headers.get('host') || '').split(',')[0]?.trim();
  const proto = xfProto || 'https';
  const detectedHost = xfHost || host;

  if (detectedHost) {
    const origin = normalize(`${proto}://${detectedHost}`);
    const hostname = detectedHost.split(':')[0]?.toLowerCase() || '';
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.endsWith('.local');

    // Never generate links to Vercel's own domain (mis-detected host can cause this).
    const isBadHost = hostname === 'vercel.com' || hostname.endsWith('.vercel.com');

    // Local development convenience (explicit local testing only).
    if (isDev && isLocalhost) return origin;
  }

  return normalize(canonical);
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

      const resetUrlObj = new URL('/auth/reset-password', baseUrlFromRequest(request));
      resetUrlObj.searchParams.set('token', token);
      resetUrlObj.searchParams.set('uid', user.id);
      const resetUrl = resetUrlObj.toString();

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

