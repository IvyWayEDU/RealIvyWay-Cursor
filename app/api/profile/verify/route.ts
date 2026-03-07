import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';

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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    const body = await request.json();

    // Send verification code
    if (body.type && body.value && !body.code) {
      const { type, value } = body;
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
    if (body.code && body.type && body.newValue) {
      const { code, type, newValue } = body;
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
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


