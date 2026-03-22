import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/auth/storage';
import { hashPassword } from '@/lib/auth/crypto';
import { createSession } from '@/lib/auth/session';
import { UserRole } from '@/lib/auth/types';
import { getUsers } from '@/lib/auth/storage';
import { createProvider } from '@/lib/providers/storage';
import crypto from 'crypto';
import { ensureStripeCustomerForUser } from '@/lib/stripe/ensureCustomer.server';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;
    
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
    
    // Validate role
    const validRoles: UserRole[] = ['student', 'provider', 'admin'];
    let userRole: UserRole = role && validRoles.includes(role) ? role : 'student';
    
    // Admin bootstrap: first user in dev mode becomes admin
    const users = await getUsers();
    if (users.length === 0 && process.env.NODE_ENV !== 'production') {
      userRole = 'admin';
    } else if (role === 'admin') {
      // Only allow admin role in dev mode, and only if no users exist
      return NextResponse.json(
        { error: 'Admin role cannot be assigned during registration' },
        { status: 400 }
      );
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
      roles: [userRole],
    });

    // Ensure Stripe customer exists for student users (best-effort; do not block registration)
    if (userRole === 'student') {
      try {
        await ensureStripeCustomerForUser(user.id);
      } catch (e) {
        console.warn('[STRIPE] Failed to create customer during registration (non-blocking):', e);
      }
    }
    
    // Create provider profile if role is provider
    if (userRole === 'provider') {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const displayName = name.trim();

      await createProvider({
        id: user.id, // Provider ID matches user ID
        userId: user.id,
        providerType: 'tutor', // Default to tutor, can be changed later
        displayName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        bio: undefined,
        profileImageUrl: undefined,
        coverImageUrl: undefined,
        phoneNumber: undefined,
        website: undefined,
        location: undefined,
        timezone: undefined,
        qualifications: [],
        certifications: [],
        yearsOfExperience: undefined,
        specialties: [],
        subjects: [],
        gradeLevels: [],
        availabilityStatus: 'available',
        workingHours: undefined,
        institutionType: undefined,
        accreditation: undefined,
        studentCapacity: undefined,
        profileComplete: false,
        verified: false,
        active: true,
      });
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
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/auth/register]' });
  }
}

