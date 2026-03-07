/**
 * Review storage for development mode
 * Stores session reviews in localStorage
 */

export interface SessionReview {
  sessionId: string;
  /**
   * New canonical linkage (supports both student->provider and provider->student).
   * Multiple reviews per session are allowed (one per reviewer).
   */
  reviewerId: string;
  revieweeId: string;
  reviewerRole?: 'student' | 'provider';

  /**
   * Legacy fields (kept for backward compatibility with older UI code).
   * For student->provider reviews, these align with reviewer/reviewee.
   * Provider->student reviews may omit these.
   */
  studentId?: string;
  providerId?: string;
  rating: number; // 1-5 stars
  reviewText?: string;
  submittedAt: string;
}

const STORAGE_KEY = 'ivyway_dev_reviews_v1';

function safeParse(json: string | null): SessionReview[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed as SessionReview[];
  } catch {
    return [];
  }
}

export function getDevReviews(): SessionReview[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function setDevReviews(reviews: SessionReview[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

export function getReviewBySessionId(sessionId: string): SessionReview | null {
  const reviews = getReviewsBySessionId(sessionId);
  if (reviews.length === 0) return null;
  // Newest first
  return reviews.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0] || null;
}

export function getReviewsBySessionId(sessionId: string): SessionReview[] {
  const reviews = getDevReviews();
  return reviews.filter((r) => r.sessionId === sessionId);
}

export function getReviewForSessionByReviewer(sessionId: string, reviewerId: string): SessionReview | null {
  const reviews = getDevReviews();
  const rid = (reviewerId || '').trim();
  if (!rid) return null;
  return (
    reviews.find((r) => r.sessionId === sessionId && (r as any)?.reviewerId === rid) ||
    // Legacy fallback: treat studentId as reviewer for older records
    reviews.find((r) => r.sessionId === sessionId && (r as any)?.studentId === rid) ||
    null
  );
}

export function hasReviewForSession(sessionId: string, reviewerId?: string): boolean {
  if (reviewerId) return getReviewForSessionByReviewer(sessionId, reviewerId) !== null;
  return getReviewBySessionId(sessionId) !== null;
}

type SubmitReviewInput =
  | Omit<SessionReview, 'submittedAt'>
  | {
      sessionId: string;
      studentId: string;
      providerId: string;
      rating: number;
      reviewText?: string;
    };

export function submitReview(review: SubmitReviewInput): void {
  const reviews = getDevReviews();

  const sessionId = String((review as any)?.sessionId || '').trim();
  const rating = Number((review as any)?.rating || 0);
  const reviewText = (review as any)?.reviewText;

  // Back-compat: if caller passed studentId/providerId, treat as student->provider review.
  const reviewerIdRaw =
    (typeof (review as any)?.reviewerId === 'string' && String((review as any).reviewerId).trim()) ||
    (typeof (review as any)?.studentId === 'string' && String((review as any).studentId).trim()) ||
    '';
  const revieweeIdRaw =
    (typeof (review as any)?.revieweeId === 'string' && String((review as any).revieweeId).trim()) ||
    (typeof (review as any)?.providerId === 'string' && String((review as any).providerId).trim()) ||
    '';

  if (!sessionId || !reviewerIdRaw || !revieweeIdRaw) return;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return;

  // Uniqueness: (sessionId, reviewerId)
  const existingIndex = reviews.findIndex(
    (r) =>
      r.sessionId === sessionId &&
      ((r as any)?.reviewerId === reviewerIdRaw || (r as any)?.studentId === reviewerIdRaw)
  );

  const nowIso = new Date().toISOString();
  const reviewWithTimestamp: SessionReview = {
    sessionId,
    reviewerId: reviewerIdRaw,
    revieweeId: revieweeIdRaw,
    reviewerRole: (review as any)?.reviewerRole,
    // Populate legacy fields when they are unambiguous (student->provider reviews).
    studentId: (review as any)?.studentId,
    providerId: (review as any)?.providerId,
    rating,
    reviewText: typeof reviewText === 'string' && reviewText.trim() ? reviewText.trim() : undefined,
    submittedAt: nowIso,
  };

  if (existingIndex >= 0) reviews[existingIndex] = reviewWithTimestamp;
  else reviews.push(reviewWithTimestamp);

  setDevReviews(reviews);
}

export function getReviewsByProviderId(providerId: string): SessionReview[] {
  const reviews = getDevReviews();
  const pid = (providerId || '').trim();
  if (!pid) return [];
  // New canonical: revieweeId is the provider (student reviewing provider)
  // Legacy: providerId field used by older records
  return reviews.filter((r) => (r as any)?.revieweeId === pid || (r as any)?.providerId === pid);
}


