import { cookies } from 'next/headers';
import crypto from 'crypto';
import { Session, UserRole } from './types';
import { getUserById } from './storage';
import { getDisplayRole } from './utils';

const SESSION_COOKIE_NAME = 'ivyway_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const SUSPENDED_LOGIN_ERROR = 'This account has been suspended. Please contact support for assistance.';

/**
 * Generate a secure session token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a session and store token in cookie
 */
export async function createSession(userId: string, email: string, name: string, roles: UserRole[]): Promise<string> {
  const cookieStore = await cookies();
  // Safety: do not create sessions for suspended users
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (Boolean((user as any).isSuspended) || (user as any).status === 'suspended') {
    throw new Error(SUSPENDED_LOGIN_ERROR);
  }

  const token = generateToken();
  const displayRole = getDisplayRole(roles);
  const session: Session = {
    userId,
    email,
    name,
    roles,
    user: {
      id: userId,
      email,
      name,
      roles,
      role: displayRole,
    },
  };
  
  // Store session data with token as key (in production, use Redis or similar)
  // For now, we'll encode the session in the cookie with the token
  const sessionData = {
    token,
    ...session,
  };
  
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  
  return token;
}

export type AuthStatus = 'ok' | 'unauthorized' | 'suspended';

export async function getAuthContext(): Promise<
  | { status: 'ok'; session: Session }
  | { status: 'unauthorized' }
  | { status: 'suspended'; message: string }
> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return { status: 'unauthorized' };
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    const roles = (Array.isArray(sessionData.roles) ? sessionData.roles : []) as UserRole[];
    const displayRole = getDisplayRole(roles);
    const session: Session = {
      userId: sessionData.userId,
      email: sessionData.email,
      name: sessionData.name,
      roles,
      user: {
        id: sessionData.userId,
        email: sessionData.email,
        name: sessionData.name,
        roles,
        role: displayRole,
      },
    };

    // Verify user still exists & is not suspended
    const user = await getUserById(session.userId);
    if (!user) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return { status: 'unauthorized' };
    }

    const isSuspended = Boolean((user as any).isSuspended) || (user as any).status === 'suspended';
    if (isSuspended) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return { status: 'suspended', message: SUSPENDED_LOGIN_ERROR };
    }

    return { status: 'ok', session };
  } catch (error) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return { status: 'unauthorized' };
  }
}

/**
 * Get session from cookie token
 */
export async function getSession(): Promise<Session | null> {
  const ctx = await getAuthContext();
  if (ctx.status !== 'ok') return null;
  return ctx.session;
}

/**
 * Delete session (logout)
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

