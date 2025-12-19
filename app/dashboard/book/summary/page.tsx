'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Types matching BookingFlowClient
type Service = 'tutoring' | 'counseling' | 'virtual-tour' | 'test-prep' | null;
type Plan = string | null;
type Subject = string | null;
type Topic = string | null;
type School = {
  displayName: string;
  normalizedName: string;
} | null;
type Provider = string | null;

interface SelectedSession {
  date: Date;
  time: string;
  displayString: string;
}

interface BookingState {
  service: Service;
  plan: Plan;
  subject: Subject;
  topic: Topic;
  school: School;
  selectedSessions: SelectedSession[];
  provider: Provider;
}

// Provider data (matching BookingFlowClient)
const MOCK_PROVIDERS: Array<{
  id: string;
  name: string;
  school: string;
  rating: number;
  role: 'Tutor' | 'Counselor';
  subject: string;
}> = [
  { id: '1', name: 'Dr. Sarah Johnson', school: 'Harvard University', rating: 4.9, role: 'Tutor', subject: 'Math' },
  { id: '2', name: 'Prof. Michael Chen', school: 'MIT', rating: 4.8, role: 'Tutor', subject: 'Science' },
  { id: '3', name: 'Dr. Emily Rodriguez', school: 'Stanford University', rating: 4.9, role: 'Tutor', subject: 'SAT' },
  { id: '4', name: 'Prof. David Kim', school: 'Yale University', rating: 4.7, role: 'Tutor', subject: 'ACT' },
  { id: '5', name: 'Dr. Lisa Wang', school: 'Princeton University', rating: 4.9, role: 'Tutor', subject: 'History & Social Studies' },
  { id: '6', name: 'Prof. James Wilson', school: 'Columbia University', rating: 4.8, role: 'Tutor', subject: 'English & Language Arts' },
  { id: '7', name: 'Dr. Maria Garcia', school: 'UCLA', rating: 4.7, role: 'Tutor', subject: 'Foreign Languages' },
  { id: '8', name: 'Prof. Robert Taylor', school: 'Carnegie Mellon', rating: 4.9, role: 'Tutor', subject: 'Computer Science' },
  { id: '13', name: 'Dr. Amanda Foster', school: 'Harvard University', rating: 4.9, role: 'Counselor', subject: 'College Counseling' },
  { id: '14', name: 'Prof. Mark Thompson', school: 'Stanford University', rating: 4.8, role: 'Counselor', subject: 'College Counseling' },
  { id: '15', name: 'Dr. Patricia Martinez', school: 'Yale University', rating: 4.7, role: 'Counselor', subject: 'College Counseling' },
  { id: '17', name: 'Campus Guide - Harvard', school: 'Harvard University', rating: 4.9, role: 'Counselor', subject: 'Virtual Tour' },
  { id: '18', name: 'Campus Guide - Stanford', school: 'Stanford University', rating: 4.8, role: 'Counselor', subject: 'Virtual Tour' },
  { id: '19', name: 'Campus Guide - MIT', school: 'MIT', rating: 4.9, role: 'Counselor', subject: 'Virtual Tour' },
];

// Plan pricing (matching BookingFlowClient)
const PLAN_PRICING: Record<string, { price: number; name: string; sessionLength: string }> = {
  'tutoring-single': { price: 69, name: 'Single Tutoring Session', sessionLength: '1 hour' },
  'tutoring-monthly': { price: 249, name: 'Monthly Tutoring Plan', sessionLength: '1 hour' },
  'test-prep-single': { price: 149, name: 'Single Test Prep Session', sessionLength: '1 hour' },
  'test-prep-monthly': { price: 499, name: 'Monthly Test Prep Bundle', sessionLength: '1 hour' },
  'counseling-30min': { price: 49, name: '30 Minute Counseling Session', sessionLength: '30 minutes' },
  'counseling-60min': { price: 89, name: '60 Minute Counseling Session', sessionLength: '60 minutes' },
  'counseling-monthly': { price: 159, name: 'Monthly Counseling Plan', sessionLength: '60 minutes' },
  'virtual-tour-single': { price: 124, name: 'Virtual College Tour', sessionLength: 'Live guided tour' },
};

// Service display names
const SERVICE_NAMES: Record<string, string> = {
  'tutoring': 'Tutoring',
  'test-prep': 'Test Prep',
  'counseling': 'College Counseling',
  'virtual-tour': 'Virtual College Tour',
};

const TOTAL_PRICE = 73.83;

export default function BookingSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);

  // Helper functions
  const getPlanInfo = () => {
    if (!bookingState?.plan) return null;
    return PLAN_PRICING[bookingState.plan];
  };

  useEffect(() => {
    // Check for cancellation parameter
    if (searchParams.get('canceled') === 'true') {
      setCanceled(true);
      // Remove the parameter from URL
      router.replace('/dashboard/book/summary', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    // Load booking state from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ivyway_booking_state');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert date strings back to Date objects
          if (parsed.selectedSessions) {
            parsed.selectedSessions = parsed.selectedSessions.map((session: any) => ({
              ...session,
              date: new Date(session.date),
            }));
          }
          setBookingState(parsed);
        } else {
          // No booking state found, redirect to booking page
          router.push('/dashboard/book');
        }
      } catch (error) {
        console.error('Error loading booking state:', error);
        router.push('/dashboard/book');
      } finally {
        setIsLoading(false);
      }
    }
  }, [router]);

  const handlePay = async () => {
    if (!bookingState) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingState: {
            ...bookingState,
            selectedSessions: bookingState.selectedSessions.map(session => ({
              ...session,
              date: session.date.toISOString(),
            })),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  const getProviderInfo = () => {
    if (!bookingState?.provider) return null;
    return MOCK_PROVIDERS.find((p) => p.id === bookingState.provider);
  };

  const getStepForEdit = (section: 'service' | 'plan' | 'datetime') => {
    // Return step number for edit navigation
    switch (section) {
      case 'service':
        return 1;
      case 'plan':
        return 2;
      case 'datetime':
        return 4;
      default:
        return 1;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center text-gray-600">Loading booking summary...</div>
        </div>
      </div>
    );
  }

  if (!bookingState) {
    return null;
  }

  const providerInfo = getProviderInfo();
  const planInfo = getPlanInfo();
  const serviceName = bookingState.service ? SERVICE_NAMES[bookingState.service] : '';

  return (
    <div className="min-h-screen w-full bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review your booking details and complete your purchase
          </p>
        </div>

        {/* Booking Details Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
          </div>

          {/* Service */}
          <div className="flex items-start justify-between py-3 border-b border-gray-100">
            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-1">Service Type</div>
              <div className="text-base font-medium text-gray-900">{serviceName}</div>
            </div>
            <Link
              href={`/dashboard/book?step=${getStepForEdit('service')}`}
              className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
            >
              Edit
            </Link>
          </div>

          {/* Plan */}
          {planInfo && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">Plan</div>
                <div className="text-base font-medium text-gray-900">{planInfo.name}</div>
              </div>
              <Link
                href={`/dashboard/book?step=${getStepForEdit('plan')}`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}

          {/* Subject or School */}
          {(bookingState.subject || bookingState.school) && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">
                  {bookingState.service === 'tutoring' || bookingState.service === 'test-prep'
                    ? 'Subject'
                    : 'School'}
                </div>
                <div className="text-base font-medium text-gray-900">
                  {bookingState.subject || bookingState.school?.displayName}
                </div>
                {bookingState.topic && (
                  <div className="text-sm text-gray-600 mt-1">
                    Topic: {bookingState.topic}
                  </div>
                )}
              </div>
              <Link
                href={`/dashboard/book?step=3`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}

          {/* Session Length */}
          {planInfo && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">Session Length</div>
                <div className="text-base font-medium text-gray-900">{planInfo.sessionLength}</div>
              </div>
            </div>
          )}

          {/* Number of Sessions */}
          {bookingState.selectedSessions.length > 0 && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">Number of Sessions</div>
                <div className="text-base font-medium text-gray-900">
                  {bookingState.selectedSessions.length} session{bookingState.selectedSessions.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* Selected Dates & Times */}
          {bookingState.selectedSessions.length > 0 && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-2">Selected Date(s) and Time(s)</div>
                <div className="space-y-2">
                  {bookingState.selectedSessions.map((session, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-md"
                    >
                      <svg className="w-5 h-5 text-[#0088CB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{session.displayString}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href={`/dashboard/book?step=${getStepForEdit('datetime')}`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}

          {/* Provider */}
          {providerInfo && (
            <div className="flex items-start justify-between py-3">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">
                  {bookingState.service === 'tutoring' || bookingState.service === 'test-prep'
                    ? 'Selected Tutor'
                    : 'Selected Counselor'}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-700">
                      {providerInfo.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="text-base font-medium text-gray-900">{providerInfo.name}</div>
                    <div className="text-sm text-gray-600">
                      {bookingState.service === 'tutoring' || bookingState.service === 'test-prep'
                        ? providerInfo.subject
                        : providerInfo.school}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{providerInfo.rating}</span>
                    </div>
                  </div>
                </div>
              </div>
              <Link
                href={`/dashboard/book?step=5`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}
        </div>

        {/* Order Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-4">
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">Total</div>
                <div className="text-2xl font-bold text-[#0088CB]">${TOTAL_PRICE.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {canceled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-900">Payment Canceled</p>
                  <p className="text-sm text-amber-700 mt-1">Your booking was not completed. You can try again below.</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full px-8 py-3 bg-[#0088CB] text-white font-semibold rounded-md hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : `Pay $${TOTAL_PRICE.toFixed(2)}`}
          </button>
        </div>

        {/* Back Button */}
        <div className="flex items-center justify-start gap-4">
          <Link
            href="/dashboard/book"
            className="px-6 py-2.5 font-medium rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Back to Booking
          </Link>
        </div>
      </div>
    </div>
  );
}
