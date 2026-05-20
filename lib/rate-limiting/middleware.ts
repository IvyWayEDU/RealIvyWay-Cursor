// RATE LIMITING
// Middleware helper for rate limiting in Next.js middleware (Edge runtime)
// Note: Uses simplified in-memory store compatible with Edge runtime

import { NextRequest, NextResponse } from 'next/server';

// Simplified store for Edge runtime (Map-based, no cleanup)
const edgeStore = new Map<string, Array<number>>();
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

// RATE LIMITING: Get client IP from Next.js request (Edge-compatible)
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  return 'unknown';
}

// RATE LIMITING: Get user ID from signed session cookie (Edge-compatible)
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;
  const verified = await verifySignedCookieValue(sessionCookie.value);
  if (!verified.ok) return null;
  return verified.payload.uid || null;
}

// RATE LIMITING: Check rate limit (Edge-compatible, simplified sliding window)
function checkRateLimitEdge(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `ratelimit:${identifier}`;

  if (!edgeStore.has(key)) {
    edgeStore.set(key, []);
  }

  const timestamps = edgeStore.get(key)!;
  const validTimestamps = timestamps.filter(ts => ts > windowStart);
  const currentCount = validTimestamps.length;
  const allowed = currentCount < maxRequests;

  // Add request if allowed
  if (allowed) {
    validTimestamps.push(now);
    edgeStore.set(key, validTimestamps);
  }

  // Calculate reset time
  const oldestTimestamp = validTimestamps.length > 0 
    ? Math.min(...validTimestamps) 
    : now;
  const resetTime = oldestTimestamp + windowMs;

  return {
    allowed,
    remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
    resetTime: Math.ceil(resetTime / 1000), // Unix timestamp in seconds
  };
}

// RATE LIMITING: Global API rate limit check (Edge-compatible)
export async function checkGlobalRateLimitEdge(request: NextRequest): Promise<{
  allowed: boolean;
  response?: NextResponse;
}> {
  const pathname = request.nextUrl.pathname;
  
  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return { allowed: true };
  }

  const ip = getClientIP(request);
  const userId = await getUserIdFromRequest(request);

  // RATE LIMITING: Apply global rate limits (100 req/min per IP, 300 req/min per user)
  // Check IP limit
  const ipLimit = checkRateLimitEdge(`ip:${ip}`, 100, 60 * 1000); // 100 req/min
  
  if (!ipLimit.allowed) {
    // RATE LIMITING: Log violation (no PII)
    console.warn('[RATE LIMITING] IP rate limit exceeded', {
      endpoint: pathname,
      identifier: ip.substring(0, 8) + '...',
      timestamp: new Date().toISOString(),
    });

    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': ipLimit.remaining.toString(),
            'X-RateLimit-Reset': ipLimit.resetTime.toString(),
            'Retry-After': ipLimit.resetTime.toString(),
          },
        }
      ),
    };
  }

  // Check user limit if authenticated
  if (userId) {
    const userLimit = checkRateLimitEdge(`user:${userId}`, 300, 60 * 1000); // 300 req/min
    
    if (!userLimit.allowed) {
      // RATE LIMITING: Log violation (no PII)
      console.warn('[RATE LIMITING] User rate limit exceeded', {
        endpoint: pathname,
        identifier: userId.substring(0, 8) + '...',
        timestamp: new Date().toISOString(),
      });

      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': '300',
              'X-RateLimit-Remaining': userLimit.remaining.toString(),
              'X-RateLimit-Reset': userLimit.resetTime.toString(),
              'Retry-After': userLimit.resetTime.toString(),
            },
          }
        ),
      };
    }
  }

  return { allowed: true };
}


