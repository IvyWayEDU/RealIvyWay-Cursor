import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/auth/storage';
import { hashPassword } from '@/lib/auth/crypto';
import { createSession } from '@/lib/auth/session';
import { UserRole } from '@/lib/auth/types';
import { getUsers } from '@/lib/auth/storage';
import crypto from 'crypto';
import { handleApiError } from '@/lib/errorHandler';
import { sendWelcomeEmailForUser } from '@/lib/email/transactional';

export async function POST(request: NextRequest) {
  try {
    console.log("ENV CHECK", {
      hasUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    const body = await request.json();
    const { name, email, password } = body;
    
    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }
    
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name must be a non-empty string' },
        { status: 400 }
      );
    }
    
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }
    
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    
    // Roles are selected AFTER account creation (mandatory `/onboarding/role`).
    // Admin bootstrap: first user in dev mode becomes admin.
    let roles: UserRole[] = [];
    const users = await getUsers();
    if (users.length === 0 && process.env.NODE_ENV !== 'production') {
      roles = ['admin'];
    }
    
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const user = await createUser({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      roles,
    });
    
    // Create session
    await createSession(user.id, user.email, user.name, user.roles);

    // Transactional email (best-effort; never block registration)
    try {
      await sendWelcomeEmailForUser({ email: user.email, name: user.name, roles: user.roles } as any);
    } catch (e) {
      console.warn('[email] welcome email failed (non-blocking)', e);
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/auth/register]' });
  }
}

