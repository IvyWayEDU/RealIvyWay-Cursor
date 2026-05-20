import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDashboardRoute, hasAccessToDashboard } from './lib/auth/utils';
import { UserRole } from './lib/auth/types';

const SESSION_COOKIE_NAME = 'ivyway_session';
const SIGNED_COOKIE_VERSION = 'v2';

type SignedSessionPayload = {
  uid: string;
  iat: number;
  exp: number;
  primaryRole?: 'student' | 'provider' | 'admin';
};

function base64urlToBytes(input: string): Uint8Array {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const b64 = normalized + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(a: string, b: string): boolean {
  const aa = String(a || '');
  const bb = String(b || '');
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

async function verifySignedCookieValue(
  rawCookieValue: string
): Promise<{ ok: true; payload: SignedSessionPayload } | { ok: false }> {
  const secret = String(process.env.SESSION_COOKIE_SIGNING_SECRET || '').trim();
  if (!secret) return { ok: false };

  const raw = String(rawCookieValue || '').trim();
  if (!raw.startsWith(`${SIGNED_COOKIE_VERSION}.`)) return { ok: false };
  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false };
  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false };

  let payload: SignedSessionPayload;
  try {
    const json = new TextDecoder().decode(base64urlToBytes(payloadB64));
    payload = JSON.parse(json) as SignedSessionPayload;
  } catch {
    return { ok: false };
  }

  if (!payload || typeof payload.uid !== 'string' || !payload.uid.trim()) return { ok: false };
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return { ok: false };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { ok: false };
  if (payload.iat > now + 60) return { ok: false };

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const expectedSigB64 = bytesToBase64url(expectedSigBytes);
    if (!constantTimeEqual(expectedSigB64, sigB64)) return { ok: false };
  } catch {
    return { ok: false };
  }

  return { ok: true, payload };
}

function clearSessionCookieOnResponse(res: NextResponse): void {
  // Best-effort: clear cookie in browser. (Cannot mutate request cookies.)
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
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
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
      if (!sessionCookie?.value) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Signed auth gate (tamper-proof). Final admin authorization is enforced server-side via DB-backed checks.
      const verified = await verifySignedCookieValue(sessionCookie.value);
      if (!verified.ok) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        const res = NextResponse.redirect(loginUrl);
        clearSessionCookieOnResponse(res);
        return res;
      }

      // Strictly block non-admins from /admin routes at the edge.
      // This is safe for routing because `primaryRole` is covered by the HMAC signature.
      if (verified.payload.primaryRole !== 'admin') {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }
  }

  // Protect all dashboard routes
  if (pathname.startsWith('/dashboard')) {
    // Get session from cookies
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    
    if (!sessionCookie?.value) {
      // No session found, redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const verified = await verifySignedCookieValue(sessionCookie.value);
    if (!verified.ok) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(loginUrl);
      clearSessionCookieOnResponse(res);
      return res;
    }

    // Routing-only role hints (NOT final authorization).
    const primaryRole = verified.payload.primaryRole;
    const routingRoles: UserRole[] =
      primaryRole === 'admin'
        ? ['admin']
        : primaryRole === 'provider'
          ? ['provider']
          : primaryRole === 'student'
            ? ['student']
            : [];

    if (routingRoles.length === 0) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(loginUrl);
      clearSessionCookieOnResponse(res);
      return res;
    }

    // Check role-based access for dashboard routing UX.
    const pathRole = getRoleFromPath(pathname);
    if (pathRole && !hasAccessToDashboard(pathRole, routingRoles)) {
      const defaultDashboard = getDashboardRoute(routingRoles);
      return NextResponse.redirect(new URL(defaultDashboard, request.url));
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

