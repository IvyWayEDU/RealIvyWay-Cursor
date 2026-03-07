'use client';

import { useState, useEffect } from 'react';
import {
  submitReview,
  getReviewForSessionByReviewer,
  SessionReview,
} from '@/lib/reviewStore';
import { getCurrentUserId } from '@/lib/sessions/actions';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  /**
   * Legacy prop name; still supported for student->provider reviews.
   * Prefer passing revieweeId + reviewerRole.
   */
  providerId?: string;
  revieweeId?: string;
  reviewerRole?: 'student' | 'provider';
  onReviewSubmitted?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  sessionId,
  providerId,
  revieweeId,
  reviewerRole,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState<SessionReview | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Get current user ID
      getCurrentUserId().then(({ userId }) => {
        setCurrentUserId(userId);
      });
    }
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!currentUserId) return;
    const review = getReviewForSessionByReviewer(sessionId, currentUserId);
    if (review) {
      setExistingReview(review);
      setRating(review.rating);
      setReviewText(review.reviewText || '');
    } else {
      setExistingReview(null);
      setRating(0);
      setReviewText('');
    }
  }, [isOpen, sessionId, currentUserId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0 || !currentUserId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const finalRevieweeId = (revieweeId || providerId || '').trim();
      if (!finalRevieweeId) return;

      const role = reviewerRole || (providerId ? 'student' : undefined);

      submitReview({
        sessionId,
        reviewerId: currentUserId,
        revieweeId: finalRevieweeId,
        reviewerRole: role,
        // Populate legacy fields when unambiguous (student->provider reviews).
        studentId: role === 'student' ? currentUserId : undefined,
        providerId: role === 'student' ? finalRevieweeId : undefined,
        rating,
        reviewText: reviewText.trim() || undefined,
      });

      // Refresh the review state
      const review = getReviewForSessionByReviewer(sessionId, currentUserId);
      setExistingReview(review);

      if (onReviewSubmitted) {
        onReviewSubmitted();
      }

      // Close modal after a brief delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = existingReview !== null;
  const canSubmit = rating > 0 && !isSubmitted && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              {isSubmitted ? 'Review Submitted' : 'Leave a Review'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isSubmitted ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`h-6 w-6 ${
                        star <= rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {reviewText && (
                  <p className="text-gray-700 mt-2">{reviewText}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Star Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <svg
                        className={`h-10 w-10 transition-colors ${
                          star <= (hoveredRating || rating)
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label htmlFor="reviewText" className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback (Optional)
                </label>
                <textarea
                  id="reviewText"
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB]"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    canSubmit
                      ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





