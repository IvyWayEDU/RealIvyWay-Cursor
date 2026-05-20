import { cookies } from 'next/headers';
import crypto from 'crypto';
import { Session, UserRole } from './types';
import { getUserAuthRowById } from './storage';
import { getDisplayRole } from './utils';

const SESSION_COOKIE_NAME = 'ivyway_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const SUSPENDED_LOGIN_ERROR = 'This account has been suspended. Please contact support for assistance.';
const SIGNED_COOKIE_VERSION = 'v2';

type SignedSessionPayload = {
  uid: string;
  iat: number;
  exp: number;
  primaryRole?: 'student' | 'provider' | 'admin';
};

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecodeToString(input: string): string {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function getSigningSecretOrNull(): string | null {
  const s = String(process.env.SESSION_COOKIE_SIGNING_SECRET || '').trim();
  return s ? s : null;
}

function signPayload(payload: SignedSessionPayload, secret: string): string {
  const json = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(json);
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64urlEncode(signature);
  return `${SIGNED_COOKIE_VERSION}.${payloadB64}.${sigB64}`;
}

function verifySignedCookieValue(
  rawCookieValue: string,
  secret: string
): { ok: true; payload: SignedSessionPayload } | { ok: false } {
  const raw = String(rawCookieValue || '').trim();
  if (!raw) return { ok: false };
  if (!raw.startsWith(`${SIGNED_COOKIE_VERSION}.`)) return { ok: false };

  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false };
  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false };

  const expectedSig = base64urlEncode(crypto.createHmac('sha256', secret).update(payloadB64).digest());
  if (!timingSafeEqual(expectedSig, sigB64)) return { ok: false };

  let payload: SignedSessionPayload | null = null;
  try {
    payload = JSON.parse(base64urlDecodeToString(payloadB64)) as SignedSessionPayload;
  } catch {
    return { ok: false };
  }

  if (!payload || typeof payload.uid !== 'string' || !payload.uid.trim()) return { ok: false };
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return { ok: false };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { ok: false };
  // Allow small clock skew; still require iat not in far future.
  if (payload.iat > now + 60) return { ok: false };

  return { ok: true, payload };
}

function buildRolesFromDbRow(params: {
  primaryRoleFromDb: string;
  dataRoles?: unknown;
}): UserRole[] {
  const primary = String(params.primaryRoleFromDb || '').trim().toLowerCase();

  // Admin MUST come from the trusted `users.role` column.
  if (primary === 'admin') return ['admin'];

  // Preserve existing behavior: if the app hasn't assigned roles yet, keep roles empty
  // so `/onboarding/role` continues to apply.
  const dataRolesRaw = params.dataRoles;
  const rolesFromData = Array.isArray(dataRolesRaw)
    ? (dataRolesRaw
        .map((r) => String(r || '').trim().toLowerCase())
        .filter(Boolean)
        .filter((r) => r === 'student' || r === 'provider' || r === 'tutor' || r === 'counselor') as UserRole[])
    : [];

  if (rolesFromData.length === 0) {
    return [];
  }

  // Enforce trusted primary role when roles are present.
  const roles = new Set<UserRole>(rolesFromData);
  if (primary === 'provider') roles.add('provider');
  if (primary === 'student') roles.add('student');

  // Drop any incompatible combinations in a conservative direction.
  // (Shouldn't happen, but we prefer to avoid elevating privileges.)
  if (roles.has('student') && (roles.has('provider') || roles.has('tutor') || roles.has('counselor'))) {
    // If DB primary says provider, keep provider-side; otherwise keep student-side.
    if (primary === 'provider') {
      roles.delete('student');
    } else {
      roles.delete('provider');
      roles.delete('tutor');
      roles.delete('counselor');
    }
  }

  return Array.from(roles);
}

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  try {
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // ignore
  }
}

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
  const secret = getSigningSecretOrNull();
  if (!secret) {
    // Fail securely: do not create a potentially forgeable session cookie.
    throw new Error('SESSION_COOKIE_SIGNING_SECRET is missing');
  }

  // Safety: do not create sessions for suspended users; trust suspension flags from DB.
  const authRow = await getUserAuthRowById(userId);
  if (!authRow) throw new Error('User not found');
  const user = authRow.data;
  if (Boolean((user as any)?.isSuspended) || (user as any)?.status === 'suspended') {
    throw new Error(SUSPENDED_LOGIN_ERROR);
  }

  const token = generateToken();
  const now = Math.floor(Date.now() / 1000);

  // Signed payload (minimal fields; roles are derived from DB at read time).
  const payload: SignedSessionPayload = {
    uid: String(userId),
    iat: now,
    exp: now + MAX_AGE,
    primaryRole: getDisplayRole(Array.isArray(roles) ? roles : []) as any,
  };

  // Token is retained for compatibility with any code that expects createSession() to return a string.
  // It is NOT stored in the cookie in v2.
  const signedValue = signPayload(payload, secret);

  cookieStore.set(SESSION_COOKIE_NAME, signedValue, {
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
    const secret = getSigningSecretOrNull();
    if (!secret) {
      // Fail securely in production. In dev, treat as logged out as well.
      clearSessionCookie(cookieStore);
      return { status: 'unauthorized' };
    }

    // Reject legacy unsigned JSON cookies (v1) and any non-v2 formats.
    const verified = verifySignedCookieValue(sessionCookie.value, secret);
    if (!verified.ok) {
      clearSessionCookie(cookieStore);
      return { status: 'unauthorized' };
    }

    const uid = verified.payload.uid;

    // Fetch trusted auth row from DB and derive roles.
    const authRow = await getUserAuthRowById(uid);
    if (!authRow) {
      clearSessionCookie(cookieStore);
      return { status: 'unauthorized' };
    }

    const user = authRow.data as any;
    const roles = buildRolesFromDbRow({
      primaryRoleFromDb: authRow.role,
      dataRoles: user?.roles,
    });
    const displayRole = getDisplayRole(roles);

    const session: Session = {
      userId: authRow.id,
      email: authRow.email,
      name: String(user?.name || ''),
      roles,
      user: {
        id: authRow.id,
        email: authRow.email,
        name: String(user?.name || ''),
        roles,
        role: displayRole,
      },
    };

    const isSuspended = Boolean(user?.isSuspended) || user?.status === 'suspended';
    if (isSuspended) {
      clearSessionCookie(cookieStore);
      return { status: 'suspended', message: SUSPENDED_LOGIN_ERROR };
    }

    return { status: 'ok', session };
  } catch {
    clearSessionCookie(cookieStore);
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

