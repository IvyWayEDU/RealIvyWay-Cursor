/**
 * HTTP Method Enforcement Utility
 * 
 * SECURITY: Ensures API routes only allow intended HTTP methods
 * 
 * Note: Next.js Route Handlers automatically return 405 for methods
 * that aren't exported. This utility provides explicit checking
 * if needed for additional validation or custom error responses.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Allowed HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

/**
 * Check if a request method is allowed
 * Returns 405 response if method is not allowed
 * 
 * @param request - NextRequest object
 * @param allowedMethods - Array of allowed HTTP methods
 * @returns NextResponse with 405 status if not allowed, null if allowed
 */
export function enforceHttpMethod(
  request: NextRequest,
  allowedMethods: HttpMethod[]
): NextResponse | null {
  const method = request.method as HttpMethod;
  
  // OPTIONS is always allowed for CORS preflight (handled by middleware)
  if (method === 'OPTIONS') {
    return null;
  }
  
  // Check if method is in allowed list
  if (!allowedMethods.includes(method)) {
    return NextResponse.json(
      { 
        error: 'Method Not Allowed',
        message: `${method} method is not allowed for this endpoint`,
        allowedMethods,
      },
      { 
        status: 405,
        headers: {
          'Allow': allowedMethods.join(', '),
        },
      }
    );
  }
  
  return null;
}

/**
 * Middleware helper to enforce HTTP methods
 * 
 * Usage in route handler:
 *   export async function GET(request: NextRequest) {
 *     const methodCheck = enforceHttpMethod(request, ['GET']);
 *     if (methodCheck) return methodCheck;
 *     // ... handler logic
 *   }
 * 
 * Note: Next.js Route Handlers already enforce methods automatically
 * by only exporting the methods you want to support. This utility
 * is for additional explicit checking if needed.
 */
export const methodEnforcement = {
  enforce: enforceHttpMethod,
};



