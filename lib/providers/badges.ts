/**
 * Provider badge calculation utilities
 * 
 * Determines which badges a provider qualifies for based on:
 * - Top Rated: Rating ≥ 4.7, ≥10 sessions, no-show < 5%
 * - Fast Responder: Median response time < 30 min over last 10 sessions
 * - Verified College Student: College field filled, school email verified
 * - IvyWay Recommended: Admin-controlled toggle
 */

import { ProviderRatingMetrics } from './rating';
import { ProviderProfile } from '@/lib/models/types';
import { User } from '@/lib/models/types';

export type BadgeType = 'top-rated' | 'fast-responder' | 'verified-college-student' | 'ivyway-recommended';

export interface Badge {
  type: BadgeType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * Check if provider qualifies for "Top Rated" badge
 */
export function qualifiesForTopRated(metrics: ProviderRatingMetrics): boolean {
  // Must have a rating (not null) to qualify
  if (metrics.weightedRating === null) return false;
  return (
    metrics.weightedRating >= 4.7 &&
    metrics.completedSessions >= 10 &&
    metrics.noShowRate < 5
  );
}

/**
 * Calculate median message response time for a provider
 * Returns median in minutes, or null if insufficient data
 */
export function calculateMedianResponseTime(
  providerId: string,
  sessionIds: string[]
): number | null {
  if (typeof window === 'undefined') return null;

  // Get messages for the last 10 sessions
  const responseTimes: number[] = [];
  
  for (const sessionId of sessionIds.slice(0, 10)) {
    const storageKey = `ivyway_messages_${sessionId}`;
    const messagesJson = window.localStorage.getItem(storageKey);
    if (!messagesJson) continue;

    try {
      const messages = JSON.parse(messagesJson);
      if (!Array.isArray(messages) || messages.length < 2) continue;

      // Find response times (time between student message and provider response)
      for (let i = 0; i < messages.length - 1; i++) {
        const current = messages[i];
        const next = messages[i + 1];

        // If current is from student and next is from provider
        if (current.senderId !== providerId && next.senderId === providerId) {
          const currentTime = new Date(current.timestamp).getTime();
          const nextTime = new Date(next.timestamp).getTime();
          const minutes = (nextTime - currentTime) / (1000 * 60);
          
          // Only count reasonable response times (not negative, not too long)
          if (minutes > 0 && minutes < 24 * 60) {
            responseTimes.push(minutes);
          }
        }
      }
    } catch {
      continue;
    }
  }

  if (responseTimes.length === 0) return null;

  // Calculate median
  responseTimes.sort((a, b) => a - b);
  const mid = Math.floor(responseTimes.length / 2);
  const median = responseTimes.length % 2 === 0
    ? (responseTimes[mid - 1] + responseTimes[mid]) / 2
    : responseTimes[mid];

  return median;
}

/**
 * Check if provider qualifies for "Fast Responder" badge
 */
export function qualifiesForFastResponder(
  providerId: string,
  sessionIds: string[]
): boolean {
  const medianResponseTime = calculateMedianResponseTime(providerId, sessionIds);
  return medianResponseTime !== null && medianResponseTime < 30;
}

/**
 * Check if provider qualifies for "Verified College Student" badge
 */
export function qualifiesForVerifiedCollegeStudent(
  profile: ProviderProfile | undefined,
  user: User | undefined
): boolean {
  if (!profile || !user) return false;
  
  // Check if college field is filled (we'll add this to ProviderProfile)
  const hasCollege = !!(profile as any).college;
  
  // Check if email is a school email (ends with .edu or common school domains)
  const isSchoolEmail = user.email.match(/\.(edu|ac\.\w{2,})$/i) !== null;
  
  return hasCollege && isSchoolEmail;
}

/**
 * Check if provider has "IvyWay Recommended" badge (admin-controlled)
 */
export function hasIvyWayRecommended(profile: ProviderProfile | undefined): boolean {
  if (!profile) return false;
  return !!(profile as any).ivyWayRecommended === true;
}

/**
 * Get all badges for a provider
 */
export function getProviderBadges(
  providerId: string,
  metrics: ProviderRatingMetrics,
  profile: ProviderProfile | undefined,
  user: User | undefined,
  sessionIds: string[]
): BadgeType[] {
  const badges: BadgeType[] = [];

  if (qualifiesForTopRated(metrics)) {
    badges.push('top-rated');
  }

  if (qualifiesForFastResponder(providerId, sessionIds)) {
    badges.push('fast-responder');
  }

  if (qualifiesForVerifiedCollegeStudent(profile, user)) {
    badges.push('verified-college-student');
  }

  if (hasIvyWayRecommended(profile)) {
    badges.push('ivyway-recommended');
  }

  return badges;
}




