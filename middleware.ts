import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDashboardRoute, hasAccessToDashboard } from './lib/auth/utils';
import { UserRole } from './lib/auth/types';

function parseSessionCookieValue(raw: string): { userId?: string; roles?: unknown } | null {
  const val = typeof raw === 'string' ? raw : '';
  if (!val) return null;
  try {
    return JSON.parse(val) as any;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(val)) as any;
    } catch {
      return null;
    }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  // Used by server layouts to determine current path (e.g. admin login bypass).
  requestHeaders.set('x-pathname', pathname);

  // Protect all admin routes (except login) with a strict 403 for non-admins.
  if (pathname.startsWith('/admin')) {
    const isAdminLoginPage = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
    if (!isAdminLoginPage) {
      const sessionCookie = request.cookies.get('ivyway_session');
      if (!sessionCookie?.value) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      const sessionData = parseSessionCookieValue(sessionCookie.value);
      const rolesRaw = sessionData?.roles;
      const roles = Array.isArray(rolesRaw) ? (rolesRaw as UserRole[]) : [];

      if (!roles.includes('admin')) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }
  }

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
      const session = parseSessionCookieValue(sessionCookie.value);
      
      if (!session || !(session as any).userId || !(session as any).roles || !Array.isArray((session as any).roles)) {
        // Invalid session, redirect to login
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check role-based access
      const pathRole = getRoleFromPath(pathname);
      const userRoles = (session as any).roles as UserRole[];

      // Verify user has access to this dashboard
      if (pathRole && !hasAccessToDashboard(pathRole, userRoles)) {
        // User doesn't have access, redirect to their default dashboard
        const defaultDashboard = getDashboardRoute(userRoles);
        return NextResponse.redirect(new URL(defaultDashboard, request.url));
      }
    } catch (_error) {
      // Invalid session format, redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function getRoleFromPath(pathname: string): 'student' | 'provider' | 'admin' | null {
  if (pathname.startsWith('/dashboard/admin')) return 'admin';
  if (pathname.startsWith('/dashboard/student')) return 'student';
  if (pathname.startsWith('/dashboard/provider')) return 'provider';
  return null;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

