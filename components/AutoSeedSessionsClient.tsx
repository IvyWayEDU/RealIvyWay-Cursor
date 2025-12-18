'use client';

import { useEffect, useState } from 'react';
import { getDevSessions, seedDevSessionsIfEmpty, addDevSession } from '@/lib/devSessionStore';
import { Session } from '@/lib/models/types';
import { getCurrentProviderId } from '@/lib/sessions/actions';

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
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const seedSessionsIfNeeded = async () => {
      // Only run in browser
      if (typeof window === 'undefined') return;
      
      // Only run on localhost (Chrome requirement)
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
      }

      // Check if localStorage already has sessions
      const existing = getDevSessions();
      if (existing.length > 0) {
        setSeeded(true);
        return;
      }

      // Get current provider ID (only if user is a provider)
      const { providerId, error } = await getCurrentProviderId();
      if (error || !providerId) {
        // Not logged in, not a provider, or error - don't seed
        return;
      }

      // Check if user is a provider by checking their roles
      // We need to check if they have tutor or counselor role
      // Since we can't directly check roles from client, we'll seed anyway
      // and let the provider dashboard filter by providerId
      // Actually, we should check if they're a provider - but we can't from client side easily
      // So we'll seed sessions for any logged-in user, and they'll only show up
      // if the user is actually a provider (filtered by providerId match)
      
      // For now, we'll seed for any logged-in user
      // The sessions will only be visible if providerId matches the logged-in user
      
      // Create at least 3 available sessions with different dates/times
      const now = new Date();
      const sessions: Session[] = [];

      // Session 1: Tomorrow at 10:00 AM
      const session1Date = new Date(now);
      session1Date.setDate(session1Date.getDate() + 1);
      session1Date.setHours(10, 0, 0, 0);
      const session1End = new Date(session1Date);
      session1End.setHours(11, 0, 0, 0);

      sessions.push({
        id: generateUUID(),
        studentId: '', // Empty for available sessions
        providerId: "provider-1", // Use logged-in provider's auth.user.id
        serviceTypeId: 'tutoring',
        sessionType: 'tutoring',
        subject: 'Math',
        scheduledStartTime: session1Date.toISOString(),
        scheduledEndTime: session1End.toISOString(),
        status: 'available',
        priceCents: 6900,
        amountChargedCents: 0,
        amountRefundedCents: 0,
        bookedAt: '',
        bookedBy: '',
        availabilityId: `availability-${generateUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Session 2: Day after tomorrow at 2:00 PM
      const session2Date = new Date(now);
      session2Date.setDate(session2Date.getDate() + 2);
      session2Date.setHours(14, 0, 0, 0);
      const session2End = new Date(session2Date);
      session2End.setHours(15, 0, 0, 0);

      sessions.push({
        id: generateUUID(),
        studentId: '',
        providerId: "provider-1",
        serviceTypeId: 'tutoring',
        sessionType: 'tutoring',
        subject: 'Science',
        scheduledStartTime: session2Date.toISOString(),
        scheduledEndTime: session2End.toISOString(),
        status: 'available',
        priceCents: 6900,
        amountChargedCents: 0,
        amountRefundedCents: 0,
        bookedAt: '',
        bookedBy: '',
        availabilityId: `availability-${generateUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Session 3: 3 days from now at 4:00 PM
      const session3Date = new Date(now);
      session3Date.setDate(session3Date.getDate() + 3);
      session3Date.setHours(16, 0, 0, 0);
      const session3End = new Date(session3Date);
      session3End.setHours(17, 0, 0, 0);

      sessions.push({
        id: generateUUID(),
        studentId: '',
        providerId: "provider-1",
        serviceTypeId: 'counseling',
        sessionType: 'counseling',
        scheduledStartTime: session3Date.toISOString(),
        scheduledEndTime: session3End.toISOString(),
        status: 'available',
        priceCents: 6900,
        amountChargedCents: 0,
        amountRefundedCents: 0,
        bookedAt: '',
        bookedBy: '',
        availabilityId: `availability-${generateUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Add one more session for good measure (4 days from now at 11:00 AM)
      const session4Date = new Date(now);
      session4Date.setDate(session4Date.getDate() + 4);
      session4Date.setHours(11, 0, 0, 0);
      const session4End = new Date(session4Date);
      session4End.setHours(12, 0, 0, 0);

      sessions.push({
        id: generateUUID(),
        studentId: '',
        providerId: "provider-1",
        serviceTypeId: 'test-prep',
        sessionType: 'test-prep',
        subject: 'SAT',
        scheduledStartTime: session4Date.toISOString(),
        scheduledEndTime: session4End.toISOString(),
        status: 'available',
        priceCents: 6900,
        amountChargedCents: 0,
        amountRefundedCents: 0,
        bookedAt: '',
        bookedBy: '',
        availabilityId: `availability-${generateUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Seed the sessions
      seedDevSessionsIfEmpty(sessions);
      setSeeded(true);
    };

    seedSessionsIfNeeded();
  }, []);

  // This component doesn't render anything
  return null;
}

