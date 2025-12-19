'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mock data for completed sessions
interface MockCompletedSession {
  id: string;
  providerName: string;
  sessionType: 'Tutoring' | 'Counseling' | 'Virtual Tour';
  subjectOrSchool: string;
  date: string;
  time: string;
  providerId: string;
  serviceType: string;
  subject?: string;
  gradeLevel?: string;
}

// Mock completed sessions data
const MOCK_COMPLETED_SESSIONS: MockCompletedSession[] = [
  {
    id: '1',
    providerName: 'Dr. Sarah Johnson',
    sessionType: 'Tutoring',
    subjectOrSchool: 'Mathematics',
    date: 'Mon, Dec 15, 2024',
    time: '3:00 PM - 4:00 PM',
    providerId: 'provider-1',
    serviceType: 'tutoring',
    subject: 'Mathematics',
    gradeLevel: '10th Grade',
  },
  {
    id: '2',
    providerName: 'College Admissions Expert',
    sessionType: 'Counseling',
    subjectOrSchool: 'College Planning',
    date: 'Wed, Dec 10, 2024',
    time: '2:00 PM - 3:00 PM',
    providerId: 'provider-2',
    serviceType: 'counseling',
  },
  {
    id: '3',
    providerName: 'Campus Tour Guide',
    sessionType: 'Virtual Tour',
    subjectOrSchool: 'Harvard University',
    date: 'Fri, Dec 5, 2024',
    time: '11:00 AM - 12:00 PM',
    providerId: 'provider-3',
    serviceType: 'virtual-tour',
  },
];

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}

function StarRating({ rating, onRatingChange, disabled = false }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isSelected = star <= (hoverRating || rating);
        return (
          <button
            key={star}
            type="button"
            onClick={() => !disabled && onRatingChange(star)}
            onMouseEnter={() => !disabled && setHoverRating(star)}
            onMouseLeave={() => !disabled && setHoverRating(0)}
            disabled={disabled}
            className={`transition-all duration-200 ${
              disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
          >
            <svg
              className={`h-6 w-6 ${
                isSelected
                  ? 'text-[#FACC15] fill-[#FACC15]'
                  : 'text-gray-300 fill-gray-300'
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

interface CompletedSessionCardProps {
  session: MockCompletedSession;
}

// Book Again Modal Component
interface BookAgainModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: MockCompletedSession;
}

function BookAgainModal({ isOpen, onClose, session }: BookAgainModalProps) {
  const [step, setStep] = useState(1);
  const [selectedServiceType, setSelectedServiceType] = useState(session.serviceType);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    setSelectedDate('');
    setSelectedTime('');
    onClose();
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const getServiceTypeLabel = (type: string): string => {
    switch (type) {
      case 'tutoring':
        return 'Tutoring';
      case 'counseling':
        return 'Counseling';
      case 'virtual-tour':
        return 'Virtual Tour';
      default:
        return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">
                  Book Again
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Step {step} of 3
                </p>

                {/* Step 1: Confirm Service Type */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Service Type
                      </label>
                      <select
                        value={selectedServiceType}
                        onChange={(e) => setSelectedServiceType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] text-sm"
                      >
                        <option value="tutoring">Tutoring</option>
                        <option value="counseling">Counseling</option>
                        <option value="virtual-tour">Virtual Tour</option>
                      </select>
                    </div>
                    <p className="text-xs text-gray-500">
                      Service type preselected from your last session
                    </p>
                  </div>
                )}

                {/* Step 2: Select Date and Time */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Time
                      </label>
                      <select
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] text-sm"
                      >
                        <option value="">Choose a time</option>
                        <option value="9:00 AM">9:00 AM</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="11:00 AM">11:00 AM</option>
                        <option value="12:00 PM">12:00 PM</option>
                        <option value="1:00 PM">1:00 PM</option>
                        <option value="2:00 PM">2:00 PM</option>
                        <option value="3:00 PM">3:00 PM</option>
                        <option value="4:00 PM">4:00 PM</option>
                        <option value="5:00 PM">5:00 PM</option>
                      </select>
                    </div>
                    <p className="text-xs text-gray-500">
                      Calendar UI placeholder - availability will be shown here
                    </p>
                  </div>
                )}

                {/* Step 3: Review Summary */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Provider:</span>
                        <p className="text-sm text-gray-900">{session.providerName}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Service Type:</span>
                        <p className="text-sm text-gray-900">{getServiceTypeLabel(selectedServiceType)}</p>
                      </div>
                      {selectedDate && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Date:</span>
                          <p className="text-sm text-gray-900">
                            {new Date(selectedDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                      {selectedTime && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Time:</span>
                          <p className="text-sm text-gray-900">{selectedTime}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Continue to checkout (UI only - no Stripe integration)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {step < 3 ? (
              <>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={step === 2 && (!selectedDate || !selectedTime)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#0088CB] text-base font-medium text-white hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={step === 1}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  alert('Continue to checkout (UI only - no Stripe integration)');
                  handleClose();
                }}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#0088CB] text-base font-medium text-white hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] sm:ml-3 sm:w-auto sm:text-sm"
              >
                Continue to Checkout
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletedSessionCard({ session }: CompletedSessionCardProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showBookAgainModal, setShowBookAgainModal] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmitReview = () => {
    if (rating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }
    
    // Console.log the review as requested
    console.log('Review submitted:', {
      sessionId: session.id,
      rating,
      reviewText,
    });
    
    setHasSubmitted(true);
    setShowReviewForm(false);
  };

  const handleCancelReview = () => {
    setShowReviewForm(false);
    setRating(0);
    setReviewText('');
  };

  const handleBookAgain = () => {
    setShowBookAgainModal(true);
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
              {session.sessionType}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {session.subjectOrSchool}
            </span>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {session.providerName}
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
                {session.date}
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
              <span>{session.time}</span>
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
          <div className="space-y-4">
            {/* Star Rating */}
            <div>
              <StarRating rating={rating} onRatingChange={setRating} />
            </div>

            {/* Review Text Area */}
            <div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write your review here…"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] text-sm transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={rating === 0}
                className="px-4 py-2 bg-white border border-[#0088CB] text-[#0088CB] text-sm font-medium rounded-md hover:bg-[#0088CB] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Review
              </button>
              <button
                type="button"
                onClick={handleCancelReview}
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
            Leave a Review
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

      {/* Book Again Modal */}
      <BookAgainModal
        isOpen={showBookAgainModal}
        onClose={() => setShowBookAgainModal(false)}
        session={session}
      />
    </div>
  );
}

export default function CompletedSessionsSection() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-[#0088CB]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Completed Sessions</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Review and rebook your past sessions
        </p>
      </div>
      <div className="p-6">
        {MOCK_COMPLETED_SESSIONS.length === 0 ? (
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
            {MOCK_COMPLETED_SESSIONS.map((session) => (
              <CompletedSessionCard
                key={session.id}
                session={session}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
