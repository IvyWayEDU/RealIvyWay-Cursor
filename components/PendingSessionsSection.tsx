'use client';

import { useState, useEffect } from 'react';
import { Session } from '@/lib/models/types';
import { getDevPendingSessionsByStudentId, getDevPendingSessionsByProviderId, updateDevSession } from '@/lib/devSessionStore';
import { getCurrentUserId, createCheckoutSession } from '@/lib/sessions/actions';

interface PendingSessionsSectionProps {
  userRole: 'student' | 'provider';
}

export interface SessionWithStudent extends Session {
  studentName?: string;
  studentEmail?: string;
}

export default function PendingSessionsSection({ userRole }: PendingSessionsSectionProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        // Get current user ID from server action
        const { userId } = await getCurrentUserId();
        if (!userId) {
          setSessions([]);
          setLoading(false);
          return;
        }

        // Read from localStorage directly on client side
        let pendingSessions: Session[] = [];
        if (userRole === 'student') {
          pendingSessions = getDevPendingSessionsByStudentId(userId);
        } else {
          // For provider, get pending sessions by provider ID
          pendingSessions = getDevPendingSessionsByProviderId(userId);
        }
        
        setSessions(pendingSessions);
      } catch (error) {
        console.error('Error fetching pending sessions:', error);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    
    // Refresh every second to catch updates
    const interval = setInterval(fetchSessions, 1000);
    return () => clearInterval(interval);
  }, [userRole]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
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

  const getSessionPriceCents = (session: Session): number => {
    // If price is already set, use it
    if (session.priceCents > 0) {
      return session.priceCents;
    }
    // Otherwise, use default prices based on session type
    switch (session.sessionType) {
      case 'tutoring':
        return 6900; // $69
      case 'counseling':
        return 8900; // $89
      case 'test-prep':
        return 14900; // $149
      default:
        return 6900; // Default to $69
    }
  };

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handlePayAndConfirm = async (session: Session) => {
    if (processingPayment) return;
    
    setProcessingPayment(session.id);
    try {
      const priceCents = getSessionPriceCents(session);
      const result = await createCheckoutSession(
        session.id,
        priceCents,
        session.sessionType
      );

      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        alert(result.error || 'Failed to create checkout session');
        setProcessingPayment(null);
      }
    } catch (error) {
      console.error('Error initiating payment:', error);
      alert('An error occurred. Please try again.');
      setProcessingPayment(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Pending Sessions</h2>
        <p className="mt-1 text-sm text-gray-500">
          {userRole === 'student' 
            ? 'Sessions waiting for payment confirmation'
            : 'Sessions waiting for student payment'}
        </p>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-sm text-gray-500">Loading pending sessions...</p>
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No pending sessions
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {userRole === 'student'
                ? 'You don\'t have any pending sessions yet.'
                : 'You don\'t have any pending sessions from students yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const isProviderView = userRole === 'provider';
              
              return (
                <div
                  key={session.id}
                  className="border border-yellow-200 rounded-lg p-4 bg-yellow-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                          Pending – awaiting payment
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getSessionTypeLabel(session.sessionType)}
                        </span>
                        {session.subject && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {session.subject}
                          </span>
                        )}
                      </div>
                      {isProviderView && session.studentId && (
                        <div className="mb-2 flex items-center gap-1 text-sm">
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span className="font-medium text-gray-900">Student: {session.studentId}</span>
                        </div>
                      )}
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
                      {userRole === 'student' && (
                        <div className="mt-3">
                          <div className="text-sm font-semibold text-gray-900 mb-1">
                            {formatPrice(getSessionPriceCents(session))}
                          </div>
                        </div>
                      )}
                    </div>
                    {userRole === 'student' && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handlePayAndConfirm(session)}
                          disabled={processingPayment === session.id}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingPayment === session.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            'Pay & Confirm'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

