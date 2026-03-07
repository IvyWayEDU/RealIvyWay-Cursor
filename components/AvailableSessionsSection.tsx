'use client';

import { useEffect } from 'react';

/**
 * Available Sessions Section
 * 
 * Displays available time slots from providers in a read-only format.
 * Students can view availability but cannot book yet.
 * 
 * Rules:
 * - No booking functionality
 * - No payment information
 * - No provider names or emails
 * - Show providers by role (providerType) and subject only
 */
export default function AvailableSessionsSection() {
  useEffect(() => {
    // Dev session helpers have been removed. This section is intentionally disabled.
  }, []);

  return null;
}

