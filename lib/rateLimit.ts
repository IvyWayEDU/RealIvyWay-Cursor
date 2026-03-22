import { NextRequest, NextResponse } from 'next/server';
import type { Session } from '@/lib/auth/types';

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment.';

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  limit: number;
};

type RateLimitOptions = {
  endpoint?: string;
  max?: number;
  windowMs?: number;
  session?: Session | null;
  /**
   * Custom key suffix for differentiating actions within one endpoint,
   * if you ever need it (defaults to none).
   */
  keySuffix?: string;
};

// Simple in-memory store: key -> request timestamps (ms)
const store = new Map<string, number[]>();

function isAdminSession(session: Session | null | undefined): boolean {
  if (!session) return false;
  if (session.user?.role === 'admin') return true;
  return Array.isArray(session.roles) && session.roles.includes('admin');
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  return 'unknown';
}

function getEndpointFromRequest(request: NextRequest): string {
  // In Next.js route handlers, nextUrl is available.
  // Fall back to parsing request.url defensively.
  const p = request.nextUrl?.pathname;
  if (typeof p === 'string' && p) return p;
  try {
    return new URL(request.url).pathname;
  } catch {
    return 'unknown-endpoint';
  }
}

export function checkRateLimit(request: NextRequest, opts: RateLimitOptions = {}): RateLimitDecision {
  const max = Number.isFinite(opts.max) ? Math.max(1, Math.floor(opts.max as number)) : 10;
  const windowMs = Number.isFinite(opts.windowMs) ? Math.max(1, Math.floor(opts.windowMs as number)) : 60_000;

  // ADMIN EXCEPTION: admins bypass rate limiting entirely.
  if (isAdminSession(opts.session)) {
    return { allowed: true, remaining: max, resetAtMs: Date.now() + windowMs, limit: max };
  }

  const ip = getClientIp(request);
  const endpoint = (opts.endpoint && String(opts.endpoint).trim()) || getEndpointFromRequest(request);
  const suffix = opts.keySuffix ? `|${String(opts.keySuffix)}` : '';
  const key = `${ip}|${endpoint}${suffix}`;

  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = store.get(key) || [];
  const recent = timestamps.filter((ts) => ts > windowStart);

  const allowed = recent.length < max;
  if (allowed) {
    recent.push(now);
    store.set(key, recent);
  } else {
    // Keep pruned timestamps to avoid unbounded growth.
    store.set(key, recent);
  }

  const oldest = recent.length > 0 ? Math.min(...recent) : now;
  const resetAtMs = oldest + windowMs;
  const remaining = allowed ? Math.max(0, max - recent.length) : 0;

  return { allowed, remaining, resetAtMs, limit: max };
}

export function rateLimitExceededResponse(body?: unknown): NextResponse {
  return NextResponse.json(
    body ?? { error: RATE_LIMIT_MESSAGE },
    { status: 429 }
  );
}

/**
 * Convenience helper for Next.js route handlers.
 * Returns a NextResponse (429) when blocked, otherwise null.
 */
export function enforceRateLimit(
  request: NextRequest,
  opts: RateLimitOptions & { body?: unknown } = {}
): NextResponse | null {
  const decision = checkRateLimit(request, opts);
  if (decision.allowed) return null;
  return rateLimitExceededResponse(opts.body);
}

// Optional: testing helper (not used in production codepaths)
export function __clearRateLimitStoreForTests(): void {
  store.clear();
}

