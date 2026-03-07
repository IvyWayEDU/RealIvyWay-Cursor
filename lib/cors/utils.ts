/**
 * CORS Security Utilities
 * 
 * SECURITY: Enforces strict CORS policy
 * - Restricts CORS to trusted origins only
 * - Blocks wildcard CORS in production
 * - Supports localhost for development
 */

import type { NextRequest } from 'next/server';

/**
 * Get trusted origins based on environment
 * Production: Uses ALLOWED_ORIGINS env var (comma-separated)
 * Development: localhost origins (http://localhost:3000, http://127.0.0.1:3000)
 * 
 * SECURITY: Never uses wildcard (*) in production
 */
export function getTrustedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production: Use ALLOWED_ORIGINS env var
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (!allowedOrigins) {
      console.warn('[CORS] ALLOWED_ORIGINS not set in production - CORS will be disabled');
      return [];
    }
    
    // Parse comma-separated origins
    const origins = allowedOrigins
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
    
    // SECURITY: Block wildcard in production
    if (origins.includes('*')) {
      console.error('[CORS] SECURITY: Wildcard (*) is not allowed in production');
      return origins.filter(origin => origin !== '*');
    }
    
    return origins;
  } else {
    // Development: Allow localhost origins
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];
  }
}

/**
 * Check if an origin is trusted
 */
export function isTrustedOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  
  const trustedOrigins = getTrustedOrigins();
  return trustedOrigins.includes(origin);
}

/**
 * Get CORS headers for a request
 * 
 * SECURITY:
 * - Only sets Access-Control-Allow-Origin for trusted origins
 * - Sets credentials headers safely
 * - Prevents credentials with wildcard
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {};
  
  // SECURITY: Only allow credentials from trusted origins
  if (origin && isTrustedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  // Allowed headers (for preflight requests)
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie, X-Requested-With';
  headers['Access-Control-Max-Age'] = '86400'; // 24 hours
  
  // Expose headers that the client might need
  headers['Access-Control-Expose-Headers'] = 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset';
  
  return headers;
}

