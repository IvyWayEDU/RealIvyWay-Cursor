'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { addDevSession } from '@/lib/devSessionStore';
import { Session } from '@/lib/models/types';

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');
  const paymentIntentId = searchParams.get('payment_intent');

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        // Load booking state from localStorage
        const stored = localStorage.getItem('ivyway_booking_state');
        if (!stored) {
          console.warn('No booking state found');
          setStatus('success');
          return;
        }

        const bookingState = JSON.parse(stored);
        
        // Convert date strings back to Date objects
        if (bookingState.selectedSessions) {
          bookingState.selectedSessions = bookingState.selectedSessions.map((session: any) => ({
            ...session,
            date: new Date(session.date),
          }));
        }

        // Create sessions and Zoom meetings via API
        const response = await fetch('/api/create-sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookingState }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to create sessions:', errorData);
          // Don't fail the payment success page, just log the error
          setStatus('success');
          return;
        }

        const data = await response.json();
        
        if (data.success && data.sessions) {
          // Store sessions in localStorage
          data.sessions.forEach((session: Session) => {
            addDevSession(session);
          });

          // Clear booking state
          localStorage.removeItem('ivyway_booking_state');
        }

        setStatus('success');
      } catch (err) {
        console.error('Error processing payment success:', err);
        // Don't fail the payment success page
        setStatus('success');
      }
    };

    // Support both Checkout Session (legacy) and PaymentIntent flows
    if (sessionId || paymentIntentId) {
      handlePaymentSuccess();
    } else {
      // No payment ID provided - could be direct navigation
      // Show success anyway (payment was already confirmed before redirect)
      const timer = setTimeout(() => {
        setStatus('success');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sessionId, paymentIntentId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0088CB] mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Payment</h2>
            <p className="text-sm text-gray-600">Please wait while we confirm your payment...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-sm text-gray-600 mb-6">
              Your booking has been confirmed. You will receive a confirmation email shortly.
            </p>
            <div className="space-y-3">
              <Link
                href="/dashboard/book"
                className="block w-full px-6 py-3 bg-[#0088CB] text-white font-semibold rounded-md hover:bg-[#0077B3] transition-colors"
              >
                Book Another Session
              </Link>
              <Link
                href="/dashboard/student"
                className="block w-full px-6 py-3 bg-white text-gray-700 font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Payment Error</h2>
            <p className="text-sm text-gray-600 mb-6">
              {error || 'An error occurred processing your payment. Please try again.'}
            </p>
            <div className="space-y-3">
              <Link
                href="/dashboard/book/summary"
                className="block w-full px-6 py-3 bg-[#0088CB] text-white font-semibold rounded-md hover:bg-[#0077B3] transition-colors"
              >
                Try Again
              </Link>
              <Link
                href="/dashboard/student"
                className="block w-full px-6 py-3 bg-white text-gray-700 font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
