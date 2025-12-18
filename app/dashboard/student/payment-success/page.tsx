'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { updateDevSession } from '@/lib/devSessionStore';
import { confirmSessionPayment } from '@/lib/sessions/actions';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      if (!sessionId) {
        setStatus('error');
        setError('No session ID provided');
        return;
      }

      try {
        // Confirm payment on server (for future database integration)
        await confirmSessionPayment(sessionId);

        // Update session status in localStorage (dev mode)
        updateDevSession(sessionId, {
          status: 'paid',
          amountChargedCents: 0, // Will be updated from Stripe webhook in production
          updatedAt: new Date().toISOString(),
        });

        setStatus('success');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard/student');
        }, 2000);
      } catch (err) {
        console.error('Error confirming payment:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to confirm payment');
      }
    };

    handlePaymentSuccess();
  }, [sessionId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Payment</h2>
            <p className="text-sm text-gray-600">Please wait while we confirm your payment...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg
                className="h-6 w-6 text-green-600"
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-sm text-gray-600 mb-4">
              Your session has been confirmed. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Error</h2>
            <p className="text-sm text-gray-600 mb-4">{error || 'An error occurred processing your payment.'}</p>
            <button
              onClick={() => router.push('/dashboard/student')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

