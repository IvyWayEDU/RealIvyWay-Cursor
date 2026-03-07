'use server';

import { NextResponse } from 'next/server';
import { getAuthContext } from './session';
import { Session, UserRole } from './types';

/**
 * Require authentication - returns session or error response
 */
export async function requireAuth(): Promise<{ session: Session } | NextResponse> {
  const ctx = await getAuthContext();

  if (ctx.status === 'suspended') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
  }

  if (ctx.status !== 'ok') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return { session: ctx.session };
}

/**
 * Require specific role - returns session or error response
 */
export async function requireRole(role: UserRole): Promise<{ session: Session } | NextResponse> {
  const authResult = await requireAuth();
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { session } = authResult;
  
  if (!session.roles.includes(role)) {
    return NextResponse.json(
      { error: `Forbidden: ${role} role required` },
      { status: 403 }
    );
  }
  
  return { session };
}

/**
 * Require any of the specified roles - returns session or error response
 */
export async function requireAnyRole(roles: UserRole[]): Promise<{ session: Session } | NextResponse> {
  const authResult = await requireAuth();
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { session } = authResult;
  
  const hasRole = roles.some(role => session.roles.includes(role));
  
  if (!hasRole) {
    return NextResponse.json(
      { error: `Forbidden: One of the following roles required: ${roles.join(', ')}` },
      { status: 403 }
    );
  }
  
  return { session };
}


