'use server';

import { hashPassword, verifyPassword } from './crypto';
import { createUser, getUserByEmail } from './storage';
import { createSession, deleteSession } from './session';
import { getDashboardRoute, validateRoles } from './utils';
import { UserRole } from './types';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

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
  roles: UserRole[]
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
    await createUser(user);

    // Create session
    await createSession(user.id, user.email, user.name, user.roles);

    // Get redirect route
    const redirectTo = getDashboardRoute(user.roles);

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

  // Create session
  await createSession(user.id, user.email, user.name, user.roles);

  // Get redirect route
  const redirectTo = getDashboardRoute(user.roles);

  return { success: true, redirectTo };
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/');
}

