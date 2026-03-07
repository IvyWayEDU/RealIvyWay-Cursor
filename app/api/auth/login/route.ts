import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/auth/storage';
import { verifyPassword } from '@/lib/auth/crypto';
import { createSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }
    
    if (typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }
    
    // Find user
    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Block suspended users AFTER password check (do not create session)
    if (Boolean((user as any).isSuspended) || (user as any).status === 'suspended') {
      return NextResponse.json(
        { error: 'This account has been suspended. Please contact support for assistance.' },
        { status: 403 }
      );
    }
    
    // Create session
    await createSession(user.id, user.email, user.name, user.roles);
    
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


