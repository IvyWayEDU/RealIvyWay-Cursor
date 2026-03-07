'use client';

/**
 * Client component to seed sessions on student dashboard load
 * 
 * NOTE: This component no longer seeds fake sessions with fake provider IDs.
 * Availability slots should be created by providers through the AvailabilitySection
 * component, which uses the provider's real auth.user.id.
 * 
 * This component is kept for backward compatibility but does nothing.
 */
export default function SeedSessionsClient() {
  // No longer seeding fake sessions - providers must create availability through their dashboard
  return null;
}



