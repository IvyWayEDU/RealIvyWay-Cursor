/**
 * Authorization utilities for API routes
 * SECURITY FIX: Centralized authorization helpers to prevent authorization gaps
 */

import { Session, UserRole } from './types';
import { NextResponse } from 'next/server';

/**
 * Check if user has required role
 * SECURITY FIX: Explicit role checking
 */
export function hasRole(session: Session, role: UserRole): boolean {
  return session.roles.includes(role);
}

/**
 * Check if user has any of the required roles
 * SECURITY FIX: Explicit role checking
 */
export function hasAnyRole(session: Session, roles: UserRole[]): boolean {
  return roles.some(role => session.roles.includes(role));
}

/**
 * Check if user is admin
 * SECURITY FIX: Explicit admin check
 */
export function isAdmin(session: Session): boolean {
  return session.roles.includes('admin');
}

/**
 * Check if user is provider (tutor or counselor)
 * SECURITY FIX: Explicit provider check
 */
export function isProvider(session: Session): boolean {
  return session.roles.includes('provider') || session.roles.includes('tutor') || session.roles.includes('counselor');
}

/**
 * Check if user is student
 * SECURITY FIX: Explicit student check
 */
export function isStudent(session: Session): boolean {
  return session.roles.includes('student');
}

/**
 * Require admin role - returns 403 response if not admin
 * SECURITY FIX: Explicit admin enforcement
 */
export function requireAdmin(session: Session | null): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdmin(session)) {
    console.warn('[SECURITY] Admin access denied:', { userId: session.userId, roles: session.roles });
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * Require provider role - returns 403 response if not provider
 * SECURITY FIX: Explicit provider enforcement
 */
export function requireProvider(session: Session | null): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isProvider(session)) {
    console.warn('[SECURITY] Provider access denied:', { userId: session.userId, roles: session.roles });
    return NextResponse.json({ error: 'Forbidden: Provider access required' }, { status: 403 });
  }
  return null;
}

/**
 * Require student role - returns 403 response if not student
 * SECURITY FIX: Explicit student enforcement
 */
export function requireStudent(session: Session | null): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStudent(session)) {
    console.warn('[SECURITY] Student access denied:', { userId: session.userId, roles: session.roles });
    return NextResponse.json({ error: 'Forbidden: Student access required' }, { status: 403 });
  }
  return null;
}

/**
 * Check ownership - ensure user owns the resource
 * SECURITY FIX: Explicit ownership validation to prevent IDOR
 */
export function checkOwnership(
  session: Session,
  resourceUserId: string,
  resourceType: string = 'resource'
): NextResponse | null {
  if (session.userId !== resourceUserId) {
    console.warn('[SECURITY] Ownership check failed:', {
      userId: session.userId,
      resourceUserId,
      resourceType,
    });
    return NextResponse.json(
      { error: `Forbidden: You can only access your own ${resourceType}` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check provider ownership or admin access
 * SECURITY FIX: Provider can access their own resources, admin can access all
 */
export function checkProviderOwnershipOrAdmin(
  session: Session,
  providerId: string,
  resourceType: string = 'resource'
): NextResponse | null {
  // Admins can access any resource
  if (isAdmin(session)) {
    return null;
  }
  
  // Providers can only access their own resources
  if (session.userId !== providerId) {
    console.warn('[SECURITY] Provider ownership check failed:', {
      userId: session.userId,
      providerId,
      resourceType,
    });
    return NextResponse.json(
      { error: `Forbidden: You can only access your own ${resourceType}` },
      { status: 403 }
    );
  }
  
  return null;
}



