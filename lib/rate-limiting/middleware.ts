// RATE LIMITING
// Middleware helper for rate limiting in Next.js middleware (Edge runtime)
// Note: Uses simplified in-memory store compatible with Edge runtime

import { NextRequest, NextResponse } from 'next/server';

// Simplified store for Edge runtime (Map-based, no cleanup)
const edgeStore = new Map<string, Array<number>>();

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

// RATE LIMITING: Get user ID from session cookie (Edge-compatible)
function getUserIdFromRequest(request: NextRequest): string | null {
  const sessionCookie = request.cookies.get('ivyway_session');
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionCookie.value);
    return session.userId || null;
  } catch {
    return null;
  }
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
export function checkGlobalRateLimitEdge(request: NextRequest): {
  allowed: boolean;
  response?: NextResponse;
} {
  const pathname = request.nextUrl.pathname;
  
  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return { allowed: true };
  }

  const ip = getClientIP(request);
  const userId = getUserIdFromRequest(request);

  // RATE LIMITING: Apply global rate limits (100 req/min per IP, 300 req/min per user)
  let ipLimit;
  let userLimit;

  // Check IP limit
  ipLimit = checkRateLimitEdge(`ip:${ip}`, 100, 60 * 1000); // 100 req/min
  
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
    userLimit = checkRateLimitEdge(`user:${userId}`, 300, 60 * 1000); // 300 req/min
    
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


