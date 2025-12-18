import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDashboardRoute, hasAccessToDashboard } from './lib/auth/utils';
import { UserRole } from './lib/auth/types';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all dashboard routes
  if (pathname.startsWith('/dashboard')) {
    // Get session from cookies
    const sessionCookie = request.cookies.get('ivyway_session');
    
    if (!sessionCookie?.value) {
      // No session found, redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Parse session to verify it's valid
      // Next.js middleware automatically decodes cookies
      const session = JSON.parse(sessionCookie.value);
      
      if (!session.userId || !session.roles || !Array.isArray(session.roles)) {
        // Invalid session, redirect to login
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check role-based access
      const pathRole = getRoleFromPath(pathname);
      const userRoles = session.roles as UserRole[];

      // Verify user has access to this dashboard
      if (pathRole && !hasAccessToDashboard(pathRole, userRoles)) {
        // User doesn't have access, redirect to their default dashboard
        const defaultDashboard = getDashboardRoute(userRoles);
        return NextResponse.redirect(new URL(defaultDashboard, request.url));
      }
    } catch (error) {
      // Invalid session format, redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

function getRoleFromPath(pathname: string): 'student' | 'provider' | 'admin' | null {
  if (pathname.startsWith('/dashboard/admin')) return 'admin';
  if (pathname.startsWith('/dashboard/student')) return 'student';
  if (pathname.startsWith('/dashboard/provider')) return 'provider';
  return null;
}

export const config = {
  matcher: '/dashboard/:path*',
};

