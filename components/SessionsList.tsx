'use client';

import { useState, useEffect } from 'react';
import { Session } from '@/lib/models/types';
import { isSessionCompleted, isSessionUpcoming } from '@/lib/sessions/lifecycle';
import { getCurrentUserId } from '@/lib/sessions/actions';
import { getSessionEndDatetimeMs, normalizeZoomJoinUrl } from '@/lib/sessions/uiHelpers';
import { useProviderSessionHeartbeat } from '@/lib/sessions/useProviderSessionHeartbeat';
import { getReviewBySessionId, hasReviewForSession } from '@/lib/reviewStore';
import { formatServiceTypeLabel, getCanonicalServiceType, getCanonicalTopicLabel } from '@/lib/sessions/sessionDisplay';
import ZoomJoinModal from './ZoomJoinModal';
import ReviewModal from './ReviewModal';

// Extended session type with provider and student information
interface SessionWithProvider extends Session {
  providerName?: string;
  providerProfileImage?: string | null;
  studentName?: string;
}

// Provider Avatar Component with image error handling
function ProviderAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [imageError, setImageError] = useState(false);
  const initials = name
    .split(' ')
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'P';
  
  const showImage = imageUrl && !imageError;
  
  return (
    <>
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-10 w-10 rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-[#0088CB] flex items-center justify-center">
          <span className="text-white text-sm font-semibold">{initials}</span>
        </div>
      )}
    </>
  );
}

interface SessionsListProps {
  role?: 'student' | 'provider';
}

export default function SessionsList({ role }: SessionsListProps) {
  const [sessions, setSessions] = useState<SessionWithProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayRole, setDisplayRole] = useState<'student' | 'provider'>('provider');
  const [zoomConfirm, setZoomConfirm] = useState<{
    session: Session;
    joinUrl: string;
    message: string;
  } | null>(null);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [reviewModalSession, setReviewModalSession] = useState<Session | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClockNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const { userId } = await getCurrentUserId();
        if (!userId) {
          console.log('[SessionsList] No userId found');
          setSessions([]);
          setLoading(false);
          return;
        }

        // Use provided role, or determine from pathname if not provided
        let currentRole = role;
        if (!currentRole && typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          if (pathname.startsWith('/dashboard/student')) {
            currentRole = 'student';
          } else if (pathname.startsWith('/dashboard/provider')) {
            currentRole = 'provider';
          } else {
            // For /dashboard/sessions, default to provider
            currentRole = 'provider';
          }
        }
        
        // Default to provider if still not determined
        currentRole = currentRole || 'provider';
        setDisplayRole(currentRole);

        console.log('[SessionsList] Fetching sessions for:', { userId, role: currentRole });

        // Fetch from API (server-side storage)
        const response = await fetch(`/api/sessions/all?role=${currentRole}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[SessionsList] API response:', data);
          if (data.sessions && Array.isArray(data.sessions)) {
            setSessions(data.sessions);
            setLoading(false);
            return;
          }
        } else {
          console.error('[SessionsList] API request failed:', response.status, response.statusText);
        }
        
        // If API fails, set empty sessions
        setSessions([]);
      } catch (error) {
        console.error('[SessionsList] Error fetching sessions:', error);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    
    // Refresh periodically to pick up session updates (webhooks / Supabase changes).
    const interval = setInterval(fetchSessions, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // STRICT BOOKING FLOW:
  // Session records include embedded snapshots; no read-time name/image lookups.

  // Format date - convert UTC stored time to user's local timezone
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time - convert UTC stored time to user's local timezone
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

  // CANONICAL BUCKETING (per spec)
  const now = new Date(clockNowMs);
  const nowMs = clockNowMs;
  const getEndMs = (s: Session) => {
    const t = new Date(s.scheduledEndTime).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const isUpcomingCanonical = (s: Session) => isSessionUpcoming(s as any, nowMs) && !isSessionCompleted(s as any, nowMs);
  const isCompletedCanonical = (s: Session) => isSessionCompleted(s as any, nowMs);
  const isSessionFlagged = (s: Session) => s.status === 'flagged';
  const isSessionCancelled = (s: Session) => s.status === 'cancelled';

  // Get effective status - return actual status (don't override)
  const getEffectiveStatus = (session: Session): Session['status'] => {
    return session.status;
  };

  const getStatusBadge = (session: Session): { label: string; className: string } => {
    const effectiveStatus = getEffectiveStatus(session);
    
    switch (effectiveStatus) {
      case 'confirmed':
        return { label: 'Scheduled', className: 'bg-green-100 text-green-800' };
      case 'completed':
        return { label: 'Completed', className: 'bg-blue-100 text-blue-800' };
      case 'flagged':
        return { label: 'Flagged', className: 'bg-yellow-100 text-yellow-800' };
      case 'cancelled':
        return { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' };
      default:
        return { label: effectiveStatus, className: 'bg-gray-100 text-gray-800' };
    }
  };

  // Check if session is in the past
  const isPastSession = (session: Session): boolean => {
    return new Date(session.scheduledStartTime) <= new Date();
  };

  // Check if session ended within last 24 hours
  const isWithin24HoursAfterEnd = (session: Session): boolean => {
    const endTime = new Date(session.scheduledEndTime);
    const hoursSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceEnd >= 0 && hoursSinceEnd <= 24;
  };

  // Check if session ended more than 24 hours ago
  const isMoreThan24HoursAfterEnd = (session: Session): boolean => {
    const endTime = new Date(session.scheduledEndTime);
    const hoursSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceEnd > 24;
  };

  // Separate sessions into canonical buckets
  const upcomingSessions = sessions.filter((s) => isUpcomingCanonical(s));
  const flaggedSessions = sessions.filter((s) => isSessionFlagged(s));
  const completedSessions = sessions.filter((s) => isCompletedCanonical(s));
  const cancelledSessions = sessions.filter((s) => isSessionCancelled(s));

  // Sort upcoming by start time ascending (soonest first)
  upcomingSessions.sort((a, b) => 
    new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  );

  // Sort flagged/completed/cancelled by end time descending (most recent first)
  flaggedSessions.sort((a, b) => new Date(b.scheduledEndTime || b.scheduledStartTime).getTime() - new Date(a.scheduledEndTime || a.scheduledStartTime).getTime());
  completedSessions.sort((a, b) => {
    const dateA = a.scheduledEndTime || a.scheduledStartTime;
    const dateB = b.scheduledEndTime || b.scheduledStartTime;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
  cancelledSessions.sort((a, b) => new Date(b.scheduledEndTime || b.scheduledStartTime).getTime() - new Date(a.scheduledEndTime || a.scheduledStartTime).getTime());

  const upcomingDescriptionText = displayRole === 'student' 
    ? 'Your confirmed future sessions'
    : 'Your confirmed future sessions with students';

  const completedDescriptionText = displayRole === 'student' 
    ? 'Your past completed sessions'
    : 'Your past completed sessions with students';

  const flaggedDescriptionText =
    displayRole === 'student'
      ? 'Sessions where the provider did not join within 10 minutes'
      : 'Sessions where you did not join within 10 minutes';

  const cancelledDescriptionText =
    displayRole === 'student'
      ? 'Your cancelled sessions'
      : 'Your cancelled sessions with students';

  // Enable heartbeat when session is active
  const isProvider = displayRole === 'provider';
  const isStudent = displayRole === 'student';
  useProviderSessionHeartbeat(activeSessionId, (isProvider || isStudent) && activeSessionId !== null, displayRole);

  return (
    <div className="space-y-8">
      {/* Upcoming Sessions Section */}
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
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-1.5M21 18.75v-1.5m-18 0h18m-18 0h-1.5m18 0h-1.5M3 12h18M3 12v-1.5m18 1.5v-1.5M3 12h1.5m15 0h1.5m-1.5 0v-1.5M9 12h.75M9 12v-1.5m.75 1.5H12m-.75-1.5v-1.5M12 12h.75m-.75 0v-1.5m.75 1.5H15m-.75 0H15m.75 0v-1.5M15 12h.75m-.75 0H18m-.75 0h.75m-.75 0v-1.5m.75 1.5v-1.5"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Sessions</h2>
              <p className="mt-1 text-sm text-gray-500">
                {upcomingDescriptionText}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading sessions...</p>
            </div>
          ) : upcomingSessions.length === 0 ? (
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No upcoming sessions
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {displayRole === 'student' 
                  ? 'Your confirmed future sessions will appear here.'
                  : 'Your confirmed future sessions will appear here after students complete payment.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.map((session) => {
              const statusBadge = getStatusBadge(session);
              const isPast = isPastSession(session);
              const isCompleted = isSessionCompleted(session);
              const within24Hours = isWithin24HoursAfterEnd(session);
              const moreThan24Hours = isMoreThan24HoursAfterEnd(session);
              const hasReview = hasReviewForSession(session.id);
              const review = getReviewBySessionId(session.id);
              
              return (
                <div
                  key={session.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    session.status === 'cancelled' || session.status === 'cancelled-late'
                      ? 'border-gray-200 bg-gray-50 hover:bg-gray-100 opacity-75'
                      : isPast
                      ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => {
                    // Navigate to session details page
                    window.location.href = `/dashboard/sessions/${session.id}`;
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Provider info for students (snapshot from session record) */}
                      {displayRole === 'student' && (
                        <div className="mb-3 flex items-center gap-3">
                          <ProviderAvatar
                            name={String((session as any)?.providerName || '')}
                            imageUrl={(session as any)?.providerProfileImage ?? undefined}
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {String((session as any)?.providerName || '')}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Student info for providers - always show, with fallback */}
                      {displayRole === 'provider' && (
                        <div className="mb-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#0088CB] flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                              {(() => {
                                const studentName = String((session as any)?.studentName || '');
                                return studentName
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2) || 'S';
                              })()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {String((session as any)?.studentName || '')}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {formatServiceTypeLabel(getCanonicalServiceType(session))}
                        </span>
                        {getCanonicalTopicLabel(session) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {getCanonicalTopicLabel(session)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600 flex-wrap">
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
                      
                      {/* Show neutral message for requires_review and no_show_provider */}
                      {(session.status === 'requires_review' || session.status === 'no_show_provider' || session.status === 'provider_no_show') && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800">
                            This session is under review.
                          </p>
                        </div>
                      )}

                      {/* Action buttons row */}
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        {/* Review button - for completed sessions (students only) */}
                        {isCompleted && displayRole === 'student' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewModalSession(session);
                            }}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              hasReview
                                ? 'bg-gray-100 text-gray-600 cursor-default'
                                : 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                            }`}
                            disabled={hasReview}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                            {hasReview ? 'Review Submitted' : 'Leave a Review'}
                          </button>
                        )}

                        {/* Review status for providers - show if review exists */}
                        {isCompleted && displayRole === 'provider' && hasReview && review && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md">
                            <svg
                              className="h-4 w-4 text-yellow-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span>Reviewed ({review.rating}/5)</span>
                          </div>
                        )}

                        {/* Message button - show if session is upcoming OR ended less than 24 hours ago */}
                        {(() => {
                          const endTime = new Date(session.scheduledEndTime);
                          const isUpcoming = endTime > now;
                          // Show if upcoming (endTime > now) OR ended less than 24 hours ago
                          // For upcoming sessions, within24Hours will be false, but isUpcoming will be true
                          const shouldShowMessage = isUpcoming || (endTime <= now && within24Hours);
                          
                          if (!shouldShowMessage) return null;
                          
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Navigate to messages page with session ID
                                window.location.href = `/dashboard/messages?sessionId=${session.id}`;
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                                />
                              </svg>
                              Message
                            </button>
                          );
                        })()}
                        {/* Start Session button - render for upcoming sessions */}
                        {(() => {
                          // Only show for upcoming sessions (sessions in upcoming section)
                          const startIso = (session as any)?.datetime ?? session.scheduledStartTime;
                          const endIso = (session as any)?.end_datetime ?? session.scheduledEndTime;
                          const sessionStart = new Date(startIso).getTime();
                          const sessionEndFromIso = new Date(endIso).getTime();
                          const sessionEnd =
                            Number.isFinite(sessionEndFromIso) ? sessionEndFromIso : sessionStart + 60 * 60 * 1000;

                          if (!Number.isFinite(sessionEnd)) return null;
                          if (sessionEnd <= nowMs) return null; // Don't show after session window ends
                          
                          const normalizedZoomUrl = normalizeZoomJoinUrl(session);
                          // Per spec: always navigate to session.zoom_join_url (participants join link).
                          const joinUrl = normalizedZoomUrl;

                          const sessionDatetime = (session as any)?.datetime;

                          if (process.env.NODE_ENV !== 'production') {
                            console.log({
                              sessionDatetime: sessionDatetime,
                              now: new Date().toISOString(),
                              startTime: new Date(sessionDatetime).getTime(),
                              nowTime: Date.now(),
                              canJoin: Date.now() >= (new Date(sessionDatetime).getTime() - 10 * 60 * 1000),
                            });
                          }

                          const now = nowMs;
                          const canJoin =
                            Number.isFinite(sessionStart) &&
                            now >= sessionStart - 10 * 60 * 1000 &&
                            now <= sessionStart + 60 * 60 * 1000;
                          
                          return (
                            <>
                              <button
                                type="button"
                                disabled={!canJoin}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!joinUrl) return;
                                  // Time gating is enforced via disabled button only.
                                  setZoomConfirm({
                                    session,
                                    joinUrl,
                                    message:
                                      displayRole === 'provider'
                                        ? 'Please allow up to 10 minutes for the student to join'
                                        : 'Please allow up to 10 minutes for the provider to join',
                                  });
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                  !canJoin
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                                }`}
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                                Join Session
                              </button>

                              {process.env.NODE_ENV !== 'production' && (
                                <div className="mt-1 max-w-[360px] text-[10px] leading-snug text-gray-500 break-words">
                                  {JSON.stringify({
                                    datetime: sessionDatetime,
                                    now: new Date().toISOString(),
                                    canJoin,
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Completed Sessions Section */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-green-600"
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
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Completed Sessions</h2>
              <p className="mt-1 text-sm text-gray-500">
                {completedDescriptionText}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading sessions...</p>
            </div>
          ) : completedSessions.length === 0 ? (
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
                No completed sessions yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Your completed sessions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedSessions.map((session) => {
                const statusBadge = getStatusBadge(session);
                const isPast = isPastSession(session);
                const isCompleted = isSessionCompleted(session);
                const within24Hours = isWithin24HoursAfterEnd(session);
                const moreThan24Hours = isMoreThan24HoursAfterEnd(session);
                const hasReview = hasReviewForSession(session.id);
                const review = getReviewBySessionId(session.id);
                
                return (
                  <div
                    key={session.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      session.status === 'cancelled' || session.status === 'cancelled-late'
                        ? 'border-gray-200 bg-gray-50 hover:bg-gray-100 opacity-75'
                        : isPast
                        ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                    }`}
                    onClick={() => {
                      // Navigate to session details page
                      window.location.href = `/dashboard/sessions/${session.id}`;
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Provider info for students (snapshot from session record) */}
                        {displayRole === 'student' && (
                          <div className="mb-3 flex items-center gap-3">
                            <ProviderAvatar
                              name={String((session as any)?.providerName || '')}
                              imageUrl={(session as any)?.providerProfileImage ?? undefined}
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {String((session as any)?.providerName || '')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Student info for providers (snapshot from session record) */}
                        {displayRole === 'provider' && (
                          <div className="mb-3 flex items-center gap-3">
                            <ProviderAvatar
                              name={String((session as any)?.studentName || '')}
                              imageUrl={(session as any)?.studentProfileImage ?? undefined}
                            />
                            <div className="text-sm font-medium text-gray-900">
                              {String((session as any)?.studentName || '')}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {formatServiceTypeLabel(getCanonicalServiceType(session))}
                          </span>
                          {getCanonicalTopicLabel(session) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {getCanonicalTopicLabel(session)}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600 flex-wrap">
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
                        
                        {/* Show neutral message for requires_review and no_show_provider */}
                        {(session.status === 'requires_review' || session.status === 'no_show_provider' || session.status === 'provider_no_show') && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <p className="text-sm text-yellow-800">
                              This session is under review.
                            </p>
                          </div>
                        )}

                        {/* Action buttons row */}
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          {/* Review button - for completed sessions (students only) */}
                          {isCompleted && displayRole === 'student' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewModalSession(session);
                              }}
                              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                hasReview
                                  ? 'bg-gray-100 text-gray-600 cursor-default'
                                  : 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                              }`}
                              disabled={hasReview}
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                              </svg>
                              {hasReview ? 'Review Submitted' : 'Leave a Review'}
                            </button>
                          )}

                          {/* Review status for providers - show if review exists */}
                          {isCompleted && displayRole === 'provider' && hasReview && review && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md">
                              <svg
                                className="h-4 w-4 text-yellow-400"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span>Reviewed ({review.rating}/5)</span>
                            </div>
                          )}

                          {/* Message button - show if session is upcoming OR ended less than 24 hours ago */}
                          {(() => {
                            const endTime = new Date(session.scheduledEndTime);
                            const isUpcoming = endTime > now;
                            // Show if upcoming (endTime > now) OR ended less than 24 hours ago
                            // For upcoming sessions, within24Hours will be false, but isUpcoming will be true
                            const shouldShowMessage = isUpcoming || (endTime <= now && within24Hours);
                            
                            if (!shouldShowMessage) return null;
                            
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Navigate to messages page with session ID
                                  window.location.href = `/dashboard/messages?sessionId=${session.id}`;
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                                  />
                                </svg>
                                Message
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Flagged Sessions Section (must remain visible; NOT upcoming; NOT completed) */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.378c.866-1.5 3.03-1.5 3.896 0l7.355 12.748zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Flagged Sessions</h2>
              <p className="mt-1 text-sm text-gray-500">{flaggedDescriptionText}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading sessions...</p>
            </div>
          ) : flaggedSessions.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">No flagged sessions</h3>
              <p className="mt-1 text-sm text-gray-500">You have no sessions currently flagged.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flaggedSessions.map((session) => {
                const statusBadge = getStatusBadge(session);
                return (
                  <div
                    key={session.id}
                    className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => {
                      window.location.href = `/dashboard/sessions/${session.id}`;
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatTime(session.scheduledStartTime)} - {formatTime(session.scheduledEndTime)} on {formatDate(session.scheduledStartTime)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      {displayRole === 'provider'
                        ? 'You did not join Zoom within 10 minutes after the start time.'
                        : 'The provider did not join Zoom within 10 minutes after the start time.'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cancelled Sessions Section */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Cancelled Sessions</h2>
              <p className="mt-1 text-sm text-gray-500">{cancelledDescriptionText}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading sessions...</p>
            </div>
          ) : cancelledSessions.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">No cancelled sessions</h3>
            </div>
          ) : (
            <div className="space-y-4">
              {cancelledSessions.map((session) => {
                const statusBadge = getStatusBadge(session);
                return (
                  <div
                    key={session.id}
                    className="border border-gray-200 bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      window.location.href = `/dashboard/sessions/${session.id}`;
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatTime(session.scheduledStartTime)} - {formatTime(session.scheduledEndTime)} on {formatDate(session.scheduledStartTime)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Zoom Join Confirm Modal */}
      {zoomConfirm && (
        <ZoomJoinModal
          isOpen={!!zoomConfirm}
          onClose={() => setZoomConfirm(null)}
          message={zoomConfirm.message}
          confirmLabel="Join Zoom Session"
          onConfirm={async () => {
            const { session, joinUrl } = zoomConfirm;
            setZoomConfirm(null);

            // Best-effort: record join + enable heartbeat, but do not block redirect on failures.
            try {
              await fetch('/api/sessions/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session.id, role: displayRole, event: 'join' }),
              });
              setActiveSessionId(session.id);
            } catch {}

            if (displayRole === 'provider') {
              try {
                await fetch('/api/sessions/track-provider-join', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: session.id }),
                });
              } catch {}
            } else {
              try {
                await fetch('/api/sessions/track-student-join', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: session.id }),
                });
              } catch {}
            }

            window.location.href = joinUrl;
          }}
        />
      )}

      {/* Review Modal */}
      {reviewModalSession && (
        <ReviewModal
          isOpen={!!reviewModalSession}
          onClose={() => setReviewModalSession(null)}
          sessionId={reviewModalSession.id}
          providerId={reviewModalSession.providerId}
          onReviewSubmitted={() => {
            // Refresh sessions to show updated review status
            const fetchSessions = async () => {
              try {
                const { userId } = await getCurrentUserId();
                if (!userId) return;

                const currentRole = displayRole;
                const response = await fetch(`/api/sessions/all?role=${currentRole}`);
                if (response.ok) {
                  const data = await response.json();
                  if (data.sessions && Array.isArray(data.sessions)) {
                    setSessions(data.sessions);
                  }
                }
              } catch (error) {
                console.error('Error refreshing sessions:', error);
              }
            };
            fetchSessions();
          }}
        />
      )}
    </div>
  );
}

