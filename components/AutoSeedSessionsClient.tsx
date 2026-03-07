'use client';

/**
 * AutoSeedSessionsClient
 * 
 * Automatically creates demo AVAILABLE sessions on app load when:
 * - localStorage ivyway_dev_sessions_v1 does NOT exist or is empty
 * - User is logged in as a PROVIDER (tutor or counselor)
 * 
 * Uses the logged-in provider's auth.user.id as providerId.
 * Creates at least 3 available sessions with different dates/times.
 */
export default function AutoSeedSessionsClient() {
  // FULL RESET / STRICT BOOKING FLOW:
  // Dev auto-seeding is disabled to ensure sessions only exist after successful payment via Stripe webhook.
  return null;
}


