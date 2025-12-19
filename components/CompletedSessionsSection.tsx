'use client';

import { useState, useEffect } from 'react';
import { Session } from '@/lib/models/types';
import { getDevCompletedSessionsByStudentId } from '@/lib/devSessionStore';
import { getCurrentUserId, getUserNameById } from '@/lib/sessions/actions';
import { getReviewBySessionId, submitReview, hasReviewForSession } from '@/lib/reviewStore';
import { useRouter } from 'next/navigation';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}

function StarRating({ rating, onRatingChange, disabled = false }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onRatingChange(star)}
          disabled={disabled}
          className={`transition-colors ${
            disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
        >
          <svg
            className={`h-6 w-6 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 fill-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

interface CompletedSessionCardProps {
  session: Session;
  providerName: string;
}

function CompletedSessionCard({ session, providerName }: CompletedSessionCardProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    // Check if review already exists
    const existingReview = getReviewBySessionId(session.id);
    if (existingReview) {
      setRating(existingReview.rating);
      setReviewText(existingReview.reviewText || '');
      setHasSubmitted(true);
    } else {
      // Check if review was already submitted
      setHasSubmitted(hasReviewForSession(session.id));
    }
  }, [session.id]);

  const handleSubmitReview = async () => {
    if (rating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { userId } = await getCurrentUserId();
      if (!userId) {
        alert('You must be logged in to submit a review.');
        return;
      }

      submitReview({
        sessionId: session.id,
        studentId: userId,
        providerId: session.providerId,
        rating,
        reviewText: reviewText.trim() || undefined,
      });

      setHasSubmitted(true);
      setShowReviewForm(false);
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAgain = () => {
    // Build query params for preselection
    const params = new URLSearchParams();
    params.set('providerId', session.providerId);
    params.set('serviceType', session.sessionType);
    if (session.subject) {
      params.set('subject', session.subject);
    }
    if (session.gradeLevel) {
      params.set('gradeLevel', session.gradeLevel);
    }
    
    router.push(`/dashboard/book?${params.toString()}`);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSessionTypeLabel = (type: string): string => {
    switch (type) {
      case 'tutoring':
        return 'Tutoring';
      case 'counseling':
        return 'Counseling';
      case 'test-prep':
        return 'Test Prep';
      default:
        return type;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Completed
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {getSessionTypeLabel(session.sessionType)}
            </span>
            {session.subject && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {session.subject}
              </span>
            )}
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {providerName}
          </h3>
          
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium text-gray-900">
                {formatDate(session.scheduledStartTime)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                {formatTime(session.scheduledStartTime)} - {formatTime(session.scheduledEndTime)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review Section */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        {hasSubmitted ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Your rating:</span>
              <StarRating rating={rating} onRatingChange={() => {}} disabled />
            </div>
            {reviewText && (
              <p className="text-sm text-gray-600 italic">"{reviewText}"</p>
            )}
            <p className="text-xs text-gray-500">Review submitted</p>
          </div>
        ) : showReviewForm ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate this session
              </label>
              <StarRating rating={rating} onRatingChange={setRating} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Write a review (optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitReview}
                disabled={isSubmitting || rating === 0}
                className="px-4 py-2 bg-white border border-[#0088CB] text-[#0088CB] text-sm font-medium rounded-md hover:bg-[#0088CB] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
              <button
                onClick={() => {
                  setShowReviewForm(false);
                  setRating(0);
                  setReviewText('');
                }}
                className="px-4 py-2 bg-white border border-red-500 text-red-500 text-sm font-medium rounded-md hover:bg-red-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowReviewForm(true)}
            className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
          >
            Write a review
          </button>
        )}
      </div>

      {/* Book Again Button */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={handleBookAgain}
          className="w-full px-4 py-2 bg-white border border-[#0088CB] text-[#0088CB] text-sm font-medium rounded-md hover:bg-[#0088CB] hover:text-white transition-colors"
        >
          Book Again
        </button>
      </div>
    </div>
  );
}

export default function CompletedSessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerNames, setProviderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const { userId } = await getCurrentUserId();
        if (!userId) {
          setSessions([]);
          setLoading(false);
          return;
        }

        const allCompletedSessions = getDevCompletedSessionsByStudentId(userId);
        // Filter to only show sessions with status 'completed' per requirements
        const completedSessions = allCompletedSessions.filter(s => s.status === 'completed');
        setSessions(completedSessions);

        // Fetch provider names
        const names: Record<string, string> = {};
        for (const session of completedSessions) {
          if (!names[session.providerId]) {
            try {
              const { name } = await getUserNameById(session.providerId);
              names[session.providerId] = name || 'Unknown Provider';
            } catch (error) {
              console.error(`Error fetching provider ${session.providerId}:`, error);
              names[session.providerId] = 'Unknown Provider';
            }
          }
        }
        setProviderNames(names);
      } catch (error) {
        console.error('Error fetching completed sessions:', error);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    
    // Refresh every second to catch updates
    const interval = setInterval(fetchSessions, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Completed Sessions</h2>
        <p className="mt-1 text-sm text-gray-500">
          Review and rebook your past sessions
        </p>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-sm text-gray-500">Loading completed sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No completed sessions
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Your completed sessions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <CompletedSessionCard
                key={session.id}
                session={session}
                providerName={providerNames[session.providerId] || 'Unknown Provider'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
