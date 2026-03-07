// RATE LIMITING
// Rate limiting utilities for IvyWay platform
// Supports IP-based and user-based rate limiting with sliding window algorithm

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string; // IP address or user ID
  endpoint?: string; // Optional endpoint name for logging
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp in milliseconds
  limit: number;
}

// In-memory store for rate limiting
// In production, consider using Redis for distributed systems
class RateLimitStore {
  private store: Map<string, Array<number>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // RATE LIMITING: Add request timestamp to store
  addRequest(key: string, windowMs: number): void {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.store.has(key)) {
      this.store.set(key, []);
    }

    const timestamps = this.store.get(key)!;
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    validTimestamps.push(now);
    
    this.store.set(key, validTimestamps);
  }

  // RATE LIMITING: Get request count within window
  getRequestCount(key: string, windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.store.has(key)) {
      return 0;
    }

    const timestamps = this.store.get(key)!;
    return timestamps.filter(ts => ts > windowStart).length;
  }

  // RATE LIMITING: Get oldest timestamp in window (for reset time calculation)
  getOldestTimestamp(key: string, windowMs: number): number | null {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.store.has(key)) {
      return null;
    }

    const timestamps = this.store.get(key)!;
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    
    if (validTimestamps.length === 0) {
      return null;
    }

    return Math.min(...validTimestamps);
  }

  // RATE LIMITING: Cleanup old entries to prevent memory leaks
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, timestamps] of this.store.entries()) {
      // Remove entries older than 1 hour (maximum window we use)
      const recentTimestamps = timestamps.filter(ts => ts > now - 60 * 60 * 1000);
      
      if (recentTimestamps.length === 0) {
        keysToDelete.push(key);
      } else {
        this.store.set(key, recentTimestamps);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));
  }

  // RATE LIMITING: Clear all entries (for testing)
  clear(): void {
    this.store.clear();
  }
}

// Global store instance
const rateLimitStore = new RateLimitStore();

// RATE LIMITING: Check if request is allowed
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs, identifier } = config;
  const key = `ratelimit:${identifier}`;
  
  const currentCount = rateLimitStore.getRequestCount(key, windowMs);
  const allowed = currentCount < maxRequests;
  
  // Calculate reset time (when oldest request in window expires)
  const oldestTimestamp = rateLimitStore.getOldestTimestamp(key, windowMs);
  const resetTime = oldestTimestamp 
    ? oldestTimestamp + windowMs 
    : Date.now() + windowMs;

  // RATE LIMITING: Log violation (no PII)
  if (!allowed) {
    console.warn('[RATE LIMITING] Rate limit exceeded', {
      identifier: identifier.substring(0, 8) + '...', // Truncated for logging
      endpoint: config.endpoint || 'unknown',
      limit: maxRequests,
      windowMs,
      timestamp: new Date().toISOString(),
    });
  }

  // Add request to store if allowed
  if (allowed) {
    rateLimitStore.addRequest(key, windowMs);
  }

  return {
    allowed,
    remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
    resetTime,
    limit: maxRequests,
  };
}

// RATE LIMITING: Get client IP from Next.js request
export function getClientIP(request: Request): string {
  // Try various headers (for proxies, load balancers, etc.)
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const realIP = headers.get('x-real-ip');
  const cfConnectingIP = headers.get('cf-connecting-ip'); // Cloudflare
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback (shouldn't happen in production with proper proxies)
  return 'unknown';
}

// RATE LIMITING: Global API rate limit (100 req/min per IP, 300 req/min per user)
export function checkGlobalRateLimit(
  request: Request,
  userId: string | null,
  endpoint?: string
): RateLimitResult {
  const ip = getClientIP(request);
  
  // RATE LIMITING: Prefer user-based limiting if available, fallback to IP
  if (userId) {
    const userLimit = checkRateLimit({
      maxRequests: 300,
      windowMs: 60 * 1000, // 1 minute
      identifier: `user:${userId}`,
      endpoint,
    });
    
    // If user limit is OK, still check IP limit (both must pass)
    if (userLimit.allowed) {
      const ipLimit = checkRateLimit({
        maxRequests: 100,
        windowMs: 60 * 1000, // 1 minute
        identifier: `ip:${ip}`,
        endpoint,
      });
      
      // Return the more restrictive result
      if (!ipLimit.allowed) {
        return ipLimit;
      }
      
      return {
        allowed: true,
        remaining: Math.min(userLimit.remaining, ipLimit.remaining),
        resetTime: Math.min(userLimit.resetTime, ipLimit.resetTime),
        limit: Math.min(userLimit.limit, ipLimit.limit),
      };
    }
    
    return userLimit;
  }
  
  // RATE LIMITING: Fallback to IP-based limiting if user not available
  return checkRateLimit({
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    identifier: `ip:${ip}`,
    endpoint,
  });
}

// RATE LIMITING: AI endpoint rate limit (strict: 10 req/hour free, 100 req/hour paid)
export function checkAIRateLimit(
  request: Request,
  userId: string,
  isPaid: boolean = false, // Default to free tier if subscription status unknown
  endpoint?: string
): RateLimitResult {
  const maxRequests = isPaid ? 100 : 10;
  const windowMs = 60 * 60 * 1000; // 1 hour
  
  return checkRateLimit({
    maxRequests,
    windowMs,
    identifier: `ai:user:${userId}`,
    endpoint: endpoint || 'ai-endpoint',
  });
}

// RATE LIMITING: Booking/Payment rate limit (prevent rapid-fire attempts)
export function checkBookingRateLimit(
  request: Request,
  userId: string | null,
  endpoint?: string
): RateLimitResult {
  const ip = getClientIP(request);
  const identifier = userId ? `booking:user:${userId}` : `booking:ip:${ip}`;
  
  // RATE LIMITING: Stricter limit for booking endpoints (20 req/min)
  return checkRateLimit({
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    identifier,
    endpoint: endpoint || 'booking-endpoint',
  });
}

// RATE LIMITING: Create rate limit response headers
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const resetTimeSeconds = Math.ceil(result.resetTime / 1000);
  
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': resetTimeSeconds.toString(),
    'Retry-After': resetTimeSeconds.toString(),
  };
}


