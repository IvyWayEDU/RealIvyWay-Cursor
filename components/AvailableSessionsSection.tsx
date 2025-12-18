'use client';

import { useState, useEffect } from 'react';
import { getDevSessions, updateDevSession } from '@/lib/devSessionStore';
import { Session } from '@/lib/models/types';
import { getCurrentUserId } from '@/lib/sessions/actions';
import { useRouter } from 'next/navigation';

/**
 * Available Sessions Section
 * 
 * Displays available time slots from providers in a read-only format.
 * Students can view availability but cannot book yet.
 * 
 * Rules:
 * - No booking functionality
 * - No payment information
 * - No provider names or emails
 * - Show providers by role (providerType) and subject only
 */
export default function AvailableSessionsSection() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSessionId, setCreatingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvailableSessions = () => {
      setLoading(true);
      
      // Get all sessions and filter by status 'available'
      const allSessions = getDevSessions();
      const availableSessions = allSessions.filter(session => session.status === 'available');
      
      setSessions(availableSessions);
      setLoading(false);
    };

    fetchAvailableSessions();
    
    // Refresh every second to catch updates
    const interval = setInterval(fetchAvailableSessions, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const handleBookSession = async (session: Session) => {
    setCreatingSessionId(session.id);
    setError(null);

    try {
      // Validate providerId before proceeding
      if (!session.providerId || session.providerId.trim() === '') {
        setError('Provider unavailable. Please choose another time.');
        setCreatingSessionId(null);
        return;
      }

      // Get the current authenticated student ID
      const { userId, error: userIdError } = await getCurrentUserId();
      if (userIdError || !userId) {
        setError(userIdError || 'You must be logged in to book a session');
        setCreatingSessionId(null);
        return;
      }

      // Find the session in localStorage and update it
      const sessions = getDevSessions();
      const sessionIndex = sessions.findIndex(s => s.id === session.id);
      
      if (sessionIndex === -1) {
        setError('Session not found. Please refresh and try again.');
        setCreatingSessionId(null);
        return;
      }

      // Update the session: set status to pending and set studentId
      updateDevSession(session.id, {
        status: 'pending',
        studentId: userId,
        bookedAt: new Date().toISOString(),
        bookedBy: userId,
        updatedAt: new Date().toISOString(),
      });

      // Remove the booked session from the available sessions list
      setSessions(prevSessions => prevSessions.filter(s => s.id !== session.id));
      
      // Refresh the page to show the new pending session
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error booking session:', err);
    } finally {
      setCreatingSessionId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Available Sessions</h2>
        <p className="mt-1 text-sm text-gray-500">
          View available time slots from providers
        </p>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-sm text-gray-500">Loading available sessions...</p>
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
              No sessions available yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Check back later for available time slots.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Provider: {session.providerId}
                      </span>
                      {session.subject && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {session.subject}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {getSessionTypeLabel(session.sessionType)}
                      </span>
                    </div>
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
                  <div className="ml-4">
                    <button
                      onClick={() => handleBookSession(session)}
                      disabled={creatingSessionId === session.id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingSessionId === session.id ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Booking...
                        </>
                      ) : (
                        'Book Session'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

