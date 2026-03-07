// RATE LIMITING
// Route-level rate limiting helpers for API routes
// Use these in route handlers for endpoint-specific rate limiting

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkAIRateLimit, checkBookingRateLimit, createRateLimitHeaders } from './index';
import { isUserPaidAI } from './subscription';

// RATE LIMITING: Apply AI endpoint rate limiting (strict: 10 req/hour free, 100 req/hour paid)
export async function withAIRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
  endpoint?: string
): Promise<NextResponse> {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // RATE LIMITING: Check subscription status (defaults to free tier)
  const isPaid = await isUserPaidAI(session.userId);
  
  // RATE LIMITING: Apply AI-specific rate limits
  const rateLimitResult = checkAIRateLimit(
    request,
    session.userId,
    isPaid,
    endpoint
  );

  if (!rateLimitResult.allowed) {
    const message = isPaid
      ? 'Rate limit exceeded. You have reached the limit of 100 AI requests per hour.'
      : 'Rate limit exceeded. Free tier allows 10 AI requests per hour. Please upgrade for higher limits.';
    
    return NextResponse.json(
      { error: message },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  // RATE LIMITING: Add rate limit headers to response
  const response = await handler(request);
  Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// RATE LIMITING: Apply booking/payment rate limiting (prevent rapid-fire attempts)
export async function withBookingRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
  endpoint?: string
): Promise<NextResponse> {
  const session = await getSession();
  const userId = session?.userId || null;

  // RATE LIMITING: Apply booking-specific rate limits
  const rateLimitResult = checkBookingRateLimit(request, userId, endpoint);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before attempting to book again.' },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  // RATE LIMITING: Add rate limit headers to response
  const response = await handler(request);
  Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}


