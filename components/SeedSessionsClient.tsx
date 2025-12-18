'use client';

import { useEffect } from 'react';
import { seedDevSessionsIfEmpty } from '@/lib/devSessionStore';
import { Session } from '@/lib/models/types';

/**
 * Generate UUID for browser
 */
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

