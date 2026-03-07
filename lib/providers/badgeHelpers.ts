/**
 * Helper functions to calculate provider badges from available data
 * Pure functions that accept data as arguments - no file system or storage access
 */

import { getProviderBadges, BadgeType } from './badges';
import { calculateWeightedRating, ProviderRatingMetrics } from './rating';
import { SessionReview } from '@/lib/reviewStore';
import { Session } from '@/lib/models/types';
import { ProviderProfile } from '@/lib/models/types';
import { User } from '@/lib/models/types';

/**
 * Calculate badges for a provider using provided data
 * Pure function - accepts all data as arguments
 * Use this in server components, server actions, or API routes where you can fetch sessions
 */
export function calculateProviderBadges(
  providerId: string,
  reviews: SessionReview[],
  sessions: Session[],
  profile?: ProviderProfile,
  user?: User
): BadgeType[] {
  try {
    // Calculate rating metrics
    const metrics = calculateWeightedRating(reviews, sessions);

    // Get session IDs for response time calculation
    const sessionIds = sessions
      .filter(s => s.status === 'completed' || s.status === 'upcoming')
      .sort((a, b) => new Date(b.scheduledStartTime).getTime() - new Date(a.scheduledStartTime).getTime())
      .map(s => s.id);

    // Get badges
    return getProviderBadges(providerId, metrics, profile, user, sessionIds);
  } catch (error) {
    console.error('Error calculating provider badges:', error);
    return [];
  }
}

/**
 * Client-side version (for use in React components)
 * Alias for calculateProviderBadges - same pure function
 */
export function calculateProviderBadgesClient(
  providerId: string,
  reviews: SessionReview[],
  sessions: Session[],
  profile?: ProviderProfile,
  user?: User
): BadgeType[] {
  return calculateProviderBadges(providerId, reviews, sessions, profile, user);
}

