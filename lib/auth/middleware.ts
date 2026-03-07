/**
 * Centralized authentication and authorization middleware for API routes
 * SECURITY: Provides consistent auth checks and IDOR protection across all routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from './session';
import { Session } from './types';
import { 
  isAdmin, 
  isProvider, 
  isStudent, 
  requireAdmin, 
  requireProvider, 
  requireStudent,
  checkOwnership,
  checkProviderOwnershipOrAdmin
} from './authorization';

/**
 * Auth result containing session and any error response
 */
export interface AuthResult {
  session: Session | null;
  error: NextResponse | null;
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(): Promise<AuthResult> {
  const ctx = await getAuthContext();
  if (ctx.status === 'suspended') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Account suspended' }, { status: 403 }),
    };
  }
  if (ctx.status !== 'ok') {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  return { session: ctx.session, error: null };
}

/**
 * Require authentication and admin role - returns 401 if not authenticated, 403 if not admin
 */
export async function requireAuthAdmin(): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (authResult.error) {
    return authResult;
  }
  
  const adminCheck = requireAdmin(authResult.session!);
  if (adminCheck) {
    return {
      session: null,
      error: adminCheck,
    };
  }
  
  return { session: authResult.session!, error: null };
}

/**
 * Require authentication and provider role - returns 401 if not authenticated, 403 if not provider
 */
export async function requireAuthProvider(): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (authResult.error) {
    return authResult;
  }
  
  const providerCheck = requireProvider(authResult.session!);
  if (providerCheck) {
    return {
      session: null,
      error: providerCheck,
    };
  }
  
  return { session: authResult.session!, error: null };
}

/**
 * Require authentication and student role - returns 401 if not authenticated, 403 if not student
 */
export async function requireAuthStudent(): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (authResult.error) {
    return authResult;
  }
  
  const studentCheck = requireStudent(authResult.session!);
  if (studentCheck) {
    return {
      session: null,
      error: studentCheck,
    };
  }
  
  return { session: authResult.session!, error: null };
}

/**
 * Check session ownership - verify user owns the session (student or provider)
 * Returns error response if ownership check fails
 */
export async function checkSessionOwnership(
  session: Session,
  sessionId: string
): Promise<NextResponse | null> {
  const { getSessionById } = await import('@/lib/sessions/storage');
  const bookingSession = await getSessionById(sessionId);
  
  if (!bookingSession) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }
  
  // Admins can access any session
  if (isAdmin(session)) {
    return null;
  }
  
  // Check if user is student and owns the session
  if (isStudent(session) && bookingSession.studentId === session.userId) {
    return null;
  }
  
  // Check if user is provider and owns the session
  if (isProvider(session) && bookingSession.providerId === session.userId) {
    return null;
  }
  
  // Ownership check failed
  console.warn('[SECURITY] Session ownership check failed:', {
    userId: session.userId,
    sessionId,
    sessionStudentId: bookingSession.studentId,
    sessionProviderId: bookingSession.providerId,
  });
  
  return NextResponse.json(
    { error: 'Forbidden: You can only access your own sessions' },
    { status: 403 }
  );
}

/**
 * Check availability ownership - verify user owns the availability
 * Returns error response if ownership check fails
 */
export async function checkAvailabilityOwnership(
  session: Session,
  providerId: string
): Promise<NextResponse | null> {
  const ownershipCheck = checkProviderOwnershipOrAdmin(session, providerId, 'availability');
  return ownershipCheck;
}

/**
 * Wrapper for API route handlers that require authentication
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     const auth = await requireAuth();
 *     if (auth.error) return auth.error;
 *     const { session } = auth;
 *     // ... rest of handler
 *   }
 */
export const auth = {
  require: requireAuth,
  requireAdmin: requireAuthAdmin,
  requireProvider: requireAuthProvider,
  requireStudent: requireAuthStudent,
  checkSessionOwnership,
  checkAvailabilityOwnership,
};



