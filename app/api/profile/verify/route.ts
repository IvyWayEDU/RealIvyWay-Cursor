import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { handleApiError } from '@/lib/errorHandler';
import { z } from 'zod';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting';

// In-memory store for verification codes (in production, use Redis or database)
const verificationCodes = new Map<string, { code: string; expiresAt: number; value: string }>();

// Generate a 6-digit verification code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up expired codes
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [key, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(key);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const SendSchema = z.object({
      type: z.enum(['email', 'phone']),
      value: z.string().min(3).max(254),
      code: z.undefined().optional(),
      newValue: z.undefined().optional(),
    }).strict();
    const VerifySchema = z.object({
      type: z.enum(['email', 'phone']),
      code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
      newValue: z.string().min(3).max(254),
    }).strict();
    const parsed = z.union([SendSchema, VerifySchema]).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    // Send verification code
    if ('value' in parsed.data) {
      const { type, value } = parsed.data;
      const rl = checkRateLimit({
        maxRequests: 5,
        windowMs: 60 * 60 * 1000,
        identifier: `verify:${type}:user:${session.userId}`,
        endpoint: '/api/profile/verify:send',
      });
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait before requesting another verification code.' },
          { status: 429, headers: createRateLimitHeaders(rl) }
        );
      }

      const code = generateCode();
      const key = `${session.userId}:${type}`;
      
      // Store code (expires in 10 minutes)
      verificationCodes.set(key, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        value,
      });

      // Clean up expired codes
      cleanupExpiredCodes();

      // In production, send code via SMS (for phone) or email (for email)
      // For now, we'll just return success
      // TODO: Integrate with SMS/Email service
      console.log(`Verification code for ${type} ${value}: ${code}`);

      return NextResponse.json({ 
        success: true, 
        message: `Verification code sent to your ${type === 'email' ? 'email' : 'phone number'}` 
      });
    }

    // Verify code
    if ('newValue' in parsed.data) {
      const { code, type, newValue } = parsed.data;
      const rl = checkRateLimit({
        maxRequests: 20,
        windowMs: 60 * 60 * 1000,
        identifier: `verify:${type}:attempts:user:${session.userId}`,
        endpoint: '/api/profile/verify:verify',
      });
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Too many verification attempts. Please wait and try again.' },
          { status: 429, headers: createRateLimitHeaders(rl) }
        );
      }

      const key = `${session.userId}:${type}`;
      const stored = verificationCodes.get(key);

      if (!stored) {
        return NextResponse.json(
          { error: 'No verification code found. Please request a new code.' },
          { status: 400 }
        );
      }

      if (stored.expiresAt < Date.now()) {
        verificationCodes.delete(key);
        return NextResponse.json(
          { error: 'Verification code has expired. Please request a new code.' },
          { status: 400 }
        );
      }

      if (stored.code !== code) {
        return NextResponse.json(
          { error: 'Invalid verification code.' },
          { status: 400 }
        );
      }

      // Code is valid - mark as verified (in production, store verification status)
      verificationCodes.delete(key);

      return NextResponse.json({ 
        success: true, 
        verified: true,
        message: 'Verification successful' 
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/profile/verify]' });
  }
}


