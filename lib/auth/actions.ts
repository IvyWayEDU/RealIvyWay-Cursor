'use server';

import { hashPassword, verifyPassword } from './crypto';
import { createUser, getUserByEmail, getUsers } from './storage';
import { createSession, deleteSession } from './session';
import { getDashboardRoute, validateRoles } from './utils';
import { UserRole } from './types';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
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
  password: string
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

  // Roles are selected AFTER account creation (mandatory `/onboarding/role`).
  // Still allow dev-only admin bootstrap for the very first user.
  let roles: UserRole[] = [];
  try {
    const existing = await getUsers();
    if (existing.length === 0 && process.env.NODE_ENV !== 'production') {
      roles = ['admin'];
    }
  } catch {
    // If bootstrap check fails, proceed with unassigned roles.
  }

  // Validate roles (allows empty)
  const roleValidation = validateRoles(roles);
  if (!roleValidation.valid) return { success: false, error: roleValidation.error };

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

    // Create session
    await createSession(created.id, created.email, created.name, created.roles);

    // Transactional email (best-effort; never block signup)
    try {
      await sendWelcomeEmailForUser({ email: created.email, name: created.name, roles: created.roles } as any);
    } catch (e) {
      console.warn('[email] welcome email failed (non-blocking)', e);
    }

    // Get redirect route (forces /onboarding/role when roles are unassigned)
    const redirectTo = getDashboardRoute(created.roles);

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

