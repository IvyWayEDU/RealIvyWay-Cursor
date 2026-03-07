/**
 * Provider rating helpers
 * Returns ratingAvg as null and ratingCount as 0 when no reviews exist
 */

import { SessionReview } from '@/lib/reviewStore';
import { Session } from '@/lib/models/types';

export interface ProviderRating {
  ratingAvg: number | null; // null when no reviews exist (never 0.0)
  ratingCount: number; // 0 when no reviews exist
}

/**
 * Metrics used by the provider badge system.
 *
 * Note: "weightedRating" is currently the same as the simple average rating.
 * Keep this shape stable; other parts of the app import it.
 */
export interface ProviderRatingMetrics {
  weightedRating: number | null; // null when no reviews exist
  ratingCount: number;
  completedSessions: number;
  noShowRate: number; // percentage in [0, 100]
}

/**
 * Calculate rating for a provider
 * Returns null for ratingAvg and 0 for ratingCount when no reviews exist
 */
export function getProviderRating(
  reviews: SessionReview[],
  sessions: Session[]
): ProviderRating {
  if (reviews.length === 0) {
    return {
      ratingAvg: null, // null when no reviews (never 0.0)
      ratingCount: 0,
    };
  }

  // Calculate simple average
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  const average = sum / reviews.length;
  
  // Round to 1 decimal place
  const ratingAvg = Math.round(average * 10) / 10;

  return {
    ratingAvg,
    ratingCount: reviews.length,
  };
}

/**
 * Backward-compatible alias used by badge helpers.
 * Returns a stable metrics object required by `lib/providers/badges.ts`.
 */
export function calculateWeightedRating(
  reviews: SessionReview[],
  sessions: Session[]
): ProviderRatingMetrics {
  const { ratingAvg, ratingCount } = getProviderRating(reviews, sessions);

  const completedSessions = sessions.filter((s: any) => s?.status === 'completed').length;
  const noShowCount = sessions.filter((s: any) =>
    [
      'no_show_provider',
      'no_show_student',
      'provider_no_show',
      'student_no_show',
      'no-show',
    ].includes(s?.status)
  ).length;

  const denom = completedSessions + noShowCount;
  const noShowRate = denom === 0 ? 0 : (noShowCount / denom) * 100;

  return {
    weightedRating: ratingAvg,
    ratingCount,
    completedSessions,
    noShowRate,
  };
}
