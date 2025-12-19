/**
 * Review storage for development mode
 * Stores session reviews in localStorage
 */

export interface SessionReview {
  sessionId: string;
  studentId: string;
  providerId: string;
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
  const reviews = getDevReviews();
  return reviews.find(r => r.sessionId === sessionId) || null;
}

export function hasReviewForSession(sessionId: string): boolean {
  return getReviewBySessionId(sessionId) !== null;
}

export function submitReview(review: Omit<SessionReview, 'submittedAt'>): void {
  const reviews = getDevReviews();
  
  // Check if review already exists for this session
  const existingIndex = reviews.findIndex(r => r.sessionId === review.sessionId);
  
  const reviewWithTimestamp: SessionReview = {
    ...review,
    submittedAt: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    // Update existing review
    reviews[existingIndex] = reviewWithTimestamp;
  } else {
    // Add new review
    reviews.push(reviewWithTimestamp);
  }
  
  setDevReviews(reviews);
}

export function getReviewsByProviderId(providerId: string): SessionReview[] {
  const reviews = getDevReviews();
  return reviews.filter(r => r.providerId === providerId);
}
