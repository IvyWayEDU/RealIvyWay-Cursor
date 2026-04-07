'use server';

import { hashPassword, verifyPassword } from './crypto';
import { createUser, getUserByEmail } from './storage';
import { createSession, deleteSession } from './session';
import { getDashboardRoute, validateRoles } from './utils';
import { UserRole } from './types';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { createProvider } from '@/lib/providers/storage';
import { ensureStripeCustomerForUser } from '@/lib/stripe/ensureCustomer.server';
import { sendWelcomeEmailForUser } from '@/lib/email/transactional';

export interface SignupResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export async function signup(
  name: string,
  email: string,
  password: string,
  roles: UserRole[],
  role?: 'student' | 'provider' | 'admin'
): Promise<SignupResult> {
  // Validate inputs
  if (!name || !email || !password) {
    return { success: false, error: 'All fields are required' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Invalid email address' };
  }

  // Validate roles
  const roleValidation = validateRoles(roles);
  if (!roleValidation.valid) {
    return { success: false, error: roleValidation.error };
  }

  // Check if user already exists
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    roles,
    createdAt: new Date().toISOString(),
  };

  try {
    const created = await createUser(user as any);

    // Ensure Stripe customer exists for students (best-effort; do not block signup if Stripe isn't configured)
    if (Array.isArray(created.roles) && created.roles.includes('student')) {
      try {
        await ensureStripeCustomerForUser(created.id);
      } catch (e) {
        console.warn('[STRIPE] Failed to create customer during signup (non-blocking):', e);
      }
    }

    // Create provider profile if role is provider
    if (role === 'provider' && roles.includes('provider')) {
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
    await createSession(created.id, created.email, created.name, created.roles);

    // Transactional email (best-effort; never block signup)
    try {
      await sendWelcomeEmailForUser({ email: created.email, name: created.name, roles: created.roles } as any);
    } catch (e) {
      console.warn('[email] welcome email failed (non-blocking)', e);
    }

    // Get redirect route
    // If provider, redirect to onboarding instead of dashboard
    let redirectTo = getDashboardRoute(created.roles);
    if (role === 'provider' && roles.includes('provider')) {
      redirectTo = '/onboarding/provider';
    }

    return { success: true, redirectTo };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Failed to create account. Please try again.' };
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // Validate inputs
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // Find user
  const user = await getUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Block suspended users AFTER password check (do not create session)
  if (Boolean((user as any).isSuspended) || (user as any).status === 'suspended') {
    return {
      success: false,
      error: 'This account has been suspended. Please contact support for assistance.',
    };
  }

  // Create session
  await createSession(user.id, user.email, user.name, user.roles);

  // Get redirect route
  const redirectTo = getDashboardRoute(user.roles);

  return { success: true, redirectTo };
}

/**
 * Admin-only login helper used by the admin login page.
 * This is intentionally stricter than `login()` and will reject non-admin users.
 */
export async function adminLogin(email: string, password: string): Promise<LoginResult> {
  // Validate inputs
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // Find user
  const user = await getUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Block suspended users AFTER password check (do not create session)
  if (Boolean((user as any).isSuspended) || (user as any).status === 'suspended') {
    return {
      success: false,
      error: 'This account has been suspended. Please contact support for assistance.',
    };
  }

  // Enforce admin role
  if (!user.roles.includes('admin')) {
    return { success: false, error: 'Administrative access only' };
  }

  // Create session
  await createSession(user.id, user.email, user.name, user.roles);

  // Admin dashboard route
  return { success: true, redirectTo: '/admin' };
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/');
}

