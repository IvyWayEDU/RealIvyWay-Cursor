'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Session } from '@/lib/models/types';
import { getCurrentUserId } from '@/lib/sessions/actions';
import { normalizeZoomJoinUrl } from '@/lib/sessions/uiHelpers';
import { hasReviewForSession, getReviewsByProviderId } from '@/lib/reviewStore';
import CancelSessionModal from '@/components/CancelSessionModal';
import ZoomJoinModal from '@/components/ZoomJoinModal';
import ReviewModal from '@/components/ReviewModal';
import ProviderBadges from '@/components/ProviderBadges';
import { calculateProviderBadgesClient } from '@/lib/providers/badgeHelpers';
import type { BadgeType } from '@/lib/providers/badges';

// Extended session type with provider and student information
interface SessionWithDetails extends Session {
  providerName?: string;
  providerProfileImage?: string | null;
  studentName?: string;
}

// Provider Avatar Component
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
          className="h-16 w-16 rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="h-16 w-16 rounded-full bg-[#0088CB] flex items-center justify-center">
          <span className="text-white text-lg font-semibold">{initials}</span>
        </div>
      )}
    </>
  );
}

export default function SessionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'student' | 'provider'>('student');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [joinConfirm, setJoinConfirm] = useState<{ joinUrl: string; sessionId: string } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [providerBadges, setProviderBadges] = useState<BadgeType[]>([]);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      try {
        const { userId } = await getCurrentUserId();
        if (!userId) {
          router.push('/dashboard/student');
          return;
        }

        // Fetch from API (try both roles). Must include flagged/cancelled/completed so no session "disappears".
        try {
          for (const role of ['student', 'provider'] as const) {
            const response = await fetch(`/api/sessions/all?role=${role}`);
            if (response.ok) {
              const data = await response.json();
              if (data.sessions && Array.isArray(data.sessions)) {
                const foundSession = data.sessions.find((s: Session) => s.id === sessionId);
                if (foundSession) {
                  // Determine user role
                  let currentUserRole: 'student' | 'provider';
                  if (foundSession.studentId === userId) {
                    currentUserRole = 'student';
                  } else if (foundSession.providerId === userId) {
                    currentUserRole = 'provider';
                  } else {
                    continue; // Try next role
                  }
                  setUserRole(currentUserRole);

                  // STRICT BOOKING FLOW:
                  // Session records already include embedded snapshots (names/images).
                  setSession(foundSession as any);
                  
                  // Calculate provider badges - fetch all sessions from API
                  try {
                    const providerIdForBadges =
                      typeof (foundSession as any)?.providerId === 'string' ? String((foundSession as any).providerId) : '';
                    if (!providerIdForBadges) {
                      setProviderBadges([]);
                    } else {
                      const providerReviews = getReviewsByProviderId(providerIdForBadges);
                    const allSessionsResponse = await fetch('/api/sessions/all?role=provider');
                    if (allSessionsResponse.ok) {
                      const allSessionsData = await allSessionsResponse.json();
                      const allSessions = allSessionsData.sessions || [];
                      const providerSessions = allSessions.filter((s: Session) => s.providerId === providerIdForBadges);
                      const badges = calculateProviderBadgesClient(
                        providerIdForBadges,
                        providerReviews,
                        providerSessions
                      );
                      setProviderBadges(badges);
                    } else {
                      // If API fails, just set empty badges
                      setProviderBadges([]);
                    }
                    }
                  } catch (badgeError) {
                    console.error('Error calculating badges:', badgeError);
                    setProviderBadges([]);
                  }
                  
                  setLoading(false);
                  return;
                }
              }
            }
          }
        } catch (apiError) {
          console.warn('API error:', apiError);
        }

        // If we get here, session was not found
        router.push('/dashboard/student');
      } catch (error) {
        console.error('Error fetching session:', error);
        router.push('/dashboard/student');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchSession();
    }
  }, [sessionId, router]);

  // Refresh periodically so the UI reflects session updates.
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(async () => {
      try {
        // Trigger a refresh by re-fetching session state using the existing logic.
        // We intentionally keep this lightweight and best-effort.
        const { userId } = await getCurrentUserId();
        if (!userId) return;

        for (const role of ['student', 'provider'] as const) {
          const response = await fetch(`/api/sessions/all?role=${role}`);
          if (!response.ok) continue;
          const data = await response.json();
          if (!data.sessions || !Array.isArray(data.sessions)) continue;

          const foundSession = data.sessions.find((s: Session) => s.id === sessionId);
          if (!foundSession) continue;

          // Preserve role inference
          if (foundSession.studentId === userId) setUserRole('student');
          else if (foundSession.providerId === userId) setUserRole('provider');

          setSession(foundSession as any);
          break;
        }
      } catch {
        // Best-effort polling only.
      }
    }, 20000);
    return () => clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Allow deep-linking from emails to the review flow.
  useEffect(() => {
    const reviewParam = searchParams?.get('review');
    if (reviewParam !== '1') return;
    if (!session) return;
    if (userRole !== 'student') return;
    if (session.status !== 'completed') return;
    if (hasReviewForSession(session.id)) return;
    setShowReviewModal(true);
  }, [searchParams, session, userRole]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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

  // Check if cancellation is allowed (>24 hours before start)
  const canCancelSession = (session: Session): boolean => {
    const startTime = new Date(session.scheduledStartTime);
    const now = new Date();
    const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilStart > 24;
  };

  const getCancellationDisabledReason = (session: Session): string | undefined => {
    if (!canCancelSession(session)) {
      const startTime = new Date(session.scheduledStartTime);
      const now = new Date();
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilStart <= 0) {
        return 'This session has already started or ended.';
      }
      return `Cancellation must be requested more than 24 hours before the session start time. This session starts in ${Math.round(hoursUntilStart * 10) / 10} hours.`;
    }
    return undefined;
  };

  // Canonical: use persisted status only (no time-derived overrides).
  const getEffectiveStatus = (session: Session): Session['status'] => session.status;

  // Check if session ended within last 24 hours
  const isWithin24HoursAfterEnd = (session: Session): boolean => {
    const endTime = new Date(session.scheduledEndTime);
    const now = new Date();
    const hoursSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceEnd >= 0 && hoursSinceEnd <= 24;
  };


  const handleCancelSession = async () => {
    if (!session) return;

    setIsCancelling(true);
    try {
      const response = await fetch('/api/sessions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to cancel session');
        setIsCancelling(false);
        return;
      }

      // Close modal and navigate back
      setShowCancelModal(false);
      router.push(`/dashboard/${userRole}`);
    } catch (error) {
      console.error('Error cancelling session:', error);
      alert('An error occurred while cancelling the session. Please try again.');
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0088CB]"></div>
          <p className="mt-4 text-sm text-gray-500">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Session not found</h3>
        <p className="mt-2 text-sm text-gray-500">The session you're looking for doesn't exist.</p>
        <button
          onClick={() => router.push(`/dashboard/${userRole}`)}
          className="mt-4 px-4 py-2 bg-[#0088CB] text-white text-sm font-medium rounded-md hover:bg-[#0077B3] transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const cancellationDisabledReason = getCancellationDisabledReason(session);
  const canCancel = canCancelSession(session);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push(`/dashboard/${userRole}`)}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Session Details</h1>
          </div>
        </div>

        {/* Session Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Main Content */}
          <div className="p-6">
            {/* Provider/Student Info */}
            <div className="mb-6">
              {userRole === 'student' && session.providerName && (
                <div className="flex items-center gap-4">
                  <ProviderAvatar name={session.providerName} imageUrl={(session as any)?.providerProfileImage ?? undefined} />
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-gray-900">{session.providerName}</h2>
                    <p className="text-sm text-gray-600">Provider</p>
                    {providerBadges.length > 0 && (
                      <div className="mt-2">
                        <ProviderBadges badges={providerBadges} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {userRole === 'provider' && session.studentName && (
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-[#0088CB] flex items-center justify-center">
                    <span className="text-white text-lg font-semibold">
                      {session.studentName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'S'}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{session.studentName}</h2>
                    <p className="text-sm text-gray-600">Student</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status and Type Badges */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                (() => {
                  const effectiveStatus = getEffectiveStatus(session);
                  if (effectiveStatus === 'completed') return 'bg-green-100 text-green-800';
                  if (effectiveStatus === 'flagged') return 'bg-yellow-100 text-yellow-800';
                  if (effectiveStatus === 'confirmed' || effectiveStatus === 'scheduled') return 'bg-blue-100 text-blue-800';
                  if (effectiveStatus === 'cancelled') return 'bg-red-100 text-red-800';
                  if (effectiveStatus === 'provider_no_show' || effectiveStatus === 'student_no_show') return 'bg-red-100 text-red-800';
                  return 'bg-gray-100 text-gray-800';
                })()
              }`}>
                {(() => {
                  const effectiveStatus = getEffectiveStatus(session);
                  if (effectiveStatus === 'scheduled') return 'Scheduled';
                  if (effectiveStatus === 'confirmed') return 'Confirmed';
                  if (effectiveStatus === 'completed') return 'Completed';
                  if (effectiveStatus === 'flagged') return 'Flagged';
                  if (effectiveStatus === 'cancelled') return 'Cancelled';
                  if (effectiveStatus === 'provider_no_show') return 'Provider No Show';
                  if (effectiveStatus === 'student_no_show') return 'Student No Show';
                  return effectiveStatus;
                })()}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                {getSessionTypeLabel(session.sessionType)}
              </span>
              {(() => {
                const subject =
                  typeof (session as any)?.subject === 'string' && String((session as any).subject).trim()
                    ? String((session as any).subject).trim()
                    : null;
                const topic =
                  typeof (session as any)?.topic === 'string' && String((session as any).topic).trim()
                    ? String((session as any).topic).trim()
                    : null;
                const label = subject && topic ? `${subject} — ${topic}` : subject || topic;
                return label ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    {label}
                  </span>
                ) : null;
              })()}
            </div>
            
            {/* Student Note for Test Prep "Other" */}
            {session.sessionType === 'test-prep' && session.subject?.toLowerCase() === 'other' && session.studentNotes && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-blue-900 mb-1">Student Note</div>
                    <div className="text-sm text-blue-800">{session.studentNotes}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Date and Time */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-lg font-medium">{formatDate(session.scheduledStartTime)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg font-medium">
                  {formatTime(session.scheduledStartTime)} - {formatTime(session.scheduledEndTime)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap pt-6 border-t border-gray-200">
              {/* Review button - for completed sessions (students only) */}
              {session.status === 'completed' && userRole === 'student' && (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    hasReviewForSession(session.id)
                      ? 'bg-gray-100 text-gray-600 cursor-default'
                      : 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                  }`}
                  disabled={hasReviewForSession(session.id)}
                >
                  {hasReviewForSession(session.id) ? 'Review Submitted' : 'Leave a Review'}
                </button>
              )}

              {/* Cancel Button - Only for students, not for completed sessions */}
              {userRole === 'student' && 
               (session.status === 'confirmed' || session.status === 'scheduled') && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-white border border-red-300 text-red-600 hover:bg-red-50"
                >
                  Cancel Session
                </button>
              )}

              {/* Message button - show for active/upcoming sessions, or completed within 24 hours */}
              {(session.status === 'confirmed' || session.status === 'scheduled' ||
                (session.status === 'completed' && isWithin24HoursAfterEnd(session))) && (
                <button
                  onClick={() => {
                    window.location.href = `/dashboard/messages?sessionId=${session.id}`;
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Message
                </button>
              )}

              {/* Join Session button - enable depends ONLY on time window */}
              {(() => {
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

                const sessionStart = new Date(sessionDatetime).getTime();
                const now = nowMs;

                const canJoinSession =
                  Number.isFinite(sessionStart) &&
                  now >= sessionStart - 10 * 60 * 1000 &&
                  now <= sessionStart + 60 * 60 * 1000;

                return (
                  <>
                    <button
                      type="button"
                      disabled={!canJoinSession}
                      onClick={() => {
                        if (!joinUrl) return;
                        // Early clicks are blocked via disabled button only.
                        setJoinConfirm({ joinUrl, sessionId: session.id });
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        canJoinSession
                          ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                          canJoin: canJoinSession,
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

      {/* Cancel Session Modal */}
      <CancelSessionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSession}
        isCancelling={isCancelling}
        disabled={!canCancel}
        disabledReason={cancellationDisabledReason}
      />
      
      {/* Zoom Join Confirm Modal */}
      {joinConfirm && (
        <ZoomJoinModal
          isOpen={!!joinConfirm}
          onClose={() => setJoinConfirm(null)}
          message={
            userRole === 'provider'
              ? 'Please allow up to 10 minutes for the student to join'
              : 'Please allow up to 10 minutes for the provider to join'
          }
          confirmLabel="Join Zoom Session"
          onConfirm={async () => {
            const { joinUrl, sessionId } = joinConfirm;
            setJoinConfirm(null);
            // Best-effort: record join, but do not block redirect after confirmation.
            try {
              const endpoint = userRole === 'provider' ? '/api/sessions/track-provider-join' : '/api/sessions/track-student-join';
              await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });
            } catch {}
            window.location.href = joinUrl;
          }}
        />
      )}

      {/* Review Modal */}
      {session && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          sessionId={session.id}
          providerId={session.providerId}
          onReviewSubmitted={() => {
            // Refresh the page to show updated review status
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

