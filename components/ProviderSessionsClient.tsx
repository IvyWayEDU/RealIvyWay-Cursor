'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@/lib/models/types';
import { formatServiceTypeLabel, getCanonicalServiceType, getCanonicalTopicLabel } from '@/lib/sessions/sessionDisplay';
import { getSessionEndTimeMs, isSessionCompleted, isSessionUpcoming } from '@/lib/sessions/lifecycle';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import ReviewModal from '@/components/ReviewModal';
import { getCurrentUserId } from '@/lib/sessions/actions';
import { ensureConversationExistsForPair } from '@/lib/messages/actions';
import { getReviewForSessionByReviewer } from '@/lib/reviewStore';
import ProviderTestCompleteSessionButton from '@/components/ProviderTestCompleteSessionButton';
import DevFinalizeSessionButton from '@/components/DevFinalizeSessionButton';

interface SessionCardProps {
  session: Session;
  isCompleted?: boolean;
  viewerRole?: 'student' | 'provider';
  currentUserId?: string | null;
  canUseTestCompletionOverride?: boolean;
  onTestOverrideCompleted?: () => void;
  onMessage?: (session: Session) => void;
  onLeaveReview?: (session: Session) => void;
}

function SessionCard({
  session,
  isCompleted = false,
  viewerRole = 'provider',
  currentUserId,
  canUseTestCompletionOverride = false,
  onTestOverrideCompleted,
  onMessage,
  onLeaveReview,
}: SessionCardProps) {
  const router = useRouter();
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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

  const getStart = (s: any) => s?.scheduledStartTime || s?.scheduledStart;
  const getEnd = (s: any) => s?.scheduledEndTime || s?.scheduledEnd;
  const serviceType = getCanonicalServiceType(session);
  const serviceTypeLabel = formatServiceTypeLabel(serviceType);
  const topicLabel = getCanonicalTopicLabel(session);

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Upcoming
      </span>
    );
  };

  // Provider earnings must ALWAYS use the fixed payout map (never include tax, never reduced by Stripe fees).
  const providerEarningsCents =
    viewerRole === 'provider' && isCompleted ? calculateProviderPayoutCentsFromSession(session) : null;
  const earnings =
    typeof providerEarningsCents === 'number' && providerEarningsCents > 0
      ? `$${(providerEarningsCents / 100).toFixed(2)}`
      : null;

  function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
    const [imageError, setImageError] = useState(false);
    const initial = (name?.trim()?.[0] || 'U').toUpperCase();
    const showImage = !!imageUrl && !imageError;

    return showImage ? (
      <img
        src={imageUrl as string}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
        onError={() => setImageError(true)}
      />
    ) : (
      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-700 text-sm font-semibold">{initial}</span>
      </div>
    );
  }

  const otherName =
    viewerRole === 'provider'
      ? String((session as any)?.studentName || '')
      : String((session as any)?.providerName || '');
  const otherProfileImage =
    viewerRole === 'provider'
      ? ((session as any)?.studentProfileImage ?? null)
      : ((session as any)?.providerProfileImage ?? null);

  const otherUserId = viewerRole === 'provider' ? session.studentId : session.providerId;
  // Reviews are only supported student -> provider. Providers must never review students.
  const existingReview =
    viewerRole === 'student' && currentUserId ? getReviewForSessionByReviewer(session.id, currentUserId) : null;
  const reviewedStars = existingReview?.rating || 0;

  const Stars = ({ count }: { count: number }) => (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= count ? 'text-yellow-500' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {viewerRole !== 'provider' && getStatusBadge()}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {serviceTypeLabel}
            </span>
            {topicLabel && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {topicLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <UserAvatar name={otherName} imageUrl={otherProfileImage} />
            <h3 className="text-lg font-semibold text-gray-900">
              {otherName}
            </h3>
          </div>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
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
              <span>{formatDate(getStart(session))}</span>
            </div>
            <div className="flex items-center gap-2">
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
                {formatTime(getStart(session))} - {formatTime(getEnd(session))}
              </span>
            </div>
            {earnings && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                <svg
                  className="h-4 w-4 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-semibold text-green-600">Earnings: {earnings}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons (sessions page only) */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onMessage?.(session)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
          Message
        </button>

        {/* Book Again (students, completed only) */}
        {viewerRole === 'student' && isCompleted && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const params = new URLSearchParams({
                serviceType: String((session as any)?.serviceType ?? ''),
                subject: String((session as any)?.subject ?? ''),
                topic: String((session as any)?.topic ?? ''),
                schoolId: String((session as any)?.schoolId ?? ''),
                schoolName: String((session as any)?.schoolName ?? (session as any)?.school ?? ''),
              });

              router.push(`/dashboard/book?${params.toString()}`);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#0088CB] text-[#0088CB] text-sm font-medium rounded-md hover:bg-[#0088CB] hover:text-white transition-colors"
          >
            Book Again
          </button>
        )}

        {viewerRole === 'provider' && canUseTestCompletionOverride && (
          <div className="w-full sm:w-auto sm:min-w-[320px]">
            <ProviderTestCompleteSessionButton
              sessionId={session.id}
              sessionStatus={String((session as any)?.status || '')}
              onCompleted={onTestOverrideCompleted}
            />
          </div>
        )}

        {viewerRole === 'provider' && process.env.NODE_ENV !== 'production' && (
          <div className="w-full sm:w-auto sm:min-w-[320px]">
            <DevFinalizeSessionButton
              sessionId={session.id}
              sessionStatus={String((session as any)?.status || '')}
              onFinalized={onTestOverrideCompleted}
            />
          </div>
        )}

        {viewerRole === 'student' && isCompleted && (
          existingReview ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md">
              <span>Reviewed</span>
              <Stars count={reviewedStars} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onLeaveReview?.(session)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088CB] text-white text-sm font-medium rounded-md hover:bg-[#0077B3] transition-colors"
              disabled={!currentUserId || !otherUserId}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              Leave a Review
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function ProviderSessionsClient({
  role = 'provider',
  canUseTestCompletionOverride = false,
}: {
  role?: 'student' | 'provider';
  canUseTestCompletionOverride?: boolean;
}) {
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const lastJsonRef = useRef<string>('');
  const didInitialLoadRef = useRef<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewModalSession, setReviewModalSession] = useState<Session | null>(null);

  const refreshSessionsRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const url = `/api/sessions/all?role=${role}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
          if (!didInitialLoadRef.current) {
            setUpcomingSessions([]);
            setCompletedSessions([]);
          }
          return;
        }
        const data = await res.json();
        const all = Array.isArray(data?.sessions) ? (data.sessions as any[]) : [];
        const nowMs = Date.now();
        const getStartMs = (s: any) => {
          const iso = s?.scheduledStartTime || s?.scheduledStart;
          const t = iso ? new Date(iso).getTime() : NaN;
          return Number.isFinite(t) ? t : 0;
        };
        const upcomingSorted = all
          .filter((s) => isSessionUpcoming(s, nowMs) && !isSessionCompleted(s, nowMs))
          .sort((a, b) => getStartMs(a) - getStartMs(b));
        const completedSorted = all
          .filter((s) => isSessionCompleted(s, nowMs))
          .sort((a, b) => {
            const ea = getSessionEndTimeMs(a) ?? 0;
            const eb = getSessionEndTimeMs(b) ?? 0;
            if (eb !== ea) return eb - ea;
            return getStartMs(b) - getStartMs(a);
          });

        const nextStr = JSON.stringify({ upcoming: upcomingSorted, completed: completedSorted });
        const changed = nextStr !== lastJsonRef.current;
        if (changed) {
          lastJsonRef.current = nextStr;
          setUpcomingSessions(upcomingSorted as Session[]);
          setCompletedSessions(completedSorted as Session[]);
        }

      } catch (error) {
        console.error('Error fetching sessions:', error);
        if (!didInitialLoadRef.current) {
          setUpcomingSessions([]);
          setCompletedSessions([]);
        }
      } finally {
        if (!didInitialLoadRef.current) {
          didInitialLoadRef.current = true;
          setLoading(false);
        }
      }
    };

    refreshSessionsRef.current = fetchSessions;
    fetchSessions().catch(() => {});
    
    // Poll (no faster than every 20 seconds) and only update state if data changed
    const interval = setInterval(fetchSessions, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getCurrentUserId().then(({ userId }) => setCurrentUserId(userId));
  }, []);

  const handleMessage = async (session: Session) => {
    const otherUserId = role === 'provider' ? session.studentId : session.providerId;
    if (!otherUserId) return;
    const { userId } = await getCurrentUserId();
    if (!userId) return;

    // Ensure conversation exists so Messages page can open it immediately.
    await ensureConversationExistsForPair(userId, otherUserId);
    window.location.href = `/dashboard/messages?userId=${encodeURIComponent(otherUserId)}`;
  };

  const handleLeaveReview = (session: Session) => {
    if (role !== 'student') return;
    setReviewModalSession(session);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0088CB]"></div>
        <p className="mt-4 text-sm text-gray-500">Loading sessions...</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Sessions</h2>
            </div>
            <div className="p-6 min-h-[220px]">
              {upcomingSessions.length === 0 ? (
                <div className="text-center py-8">
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
                    Your upcoming sessions will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[520px] overflow-auto">
                  {upcomingSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isCompleted={false}
                      viewerRole={role}
                      currentUserId={currentUserId}
                      canUseTestCompletionOverride={canUseTestCompletionOverride && role === 'provider'}
                      onTestOverrideCompleted={() => refreshSessionsRef.current?.()}
                      onMessage={handleMessage}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Completed Sessions */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Completed Sessions</h2>
            </div>
            <div className="p-6 min-h-[220px]">
              {completedSessions.length === 0 ? (
                <div className="text-center py-8">
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
                    Your completed sessions will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[520px] overflow-auto">
                  {completedSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isCompleted={true}
                      viewerRole={role}
                      currentUserId={currentUserId}
                      canUseTestCompletionOverride={canUseTestCompletionOverride && role === 'provider'}
                      onTestOverrideCompleted={() => refreshSessionsRef.current?.()}
                      onMessage={handleMessage}
                      onLeaveReview={role === 'student' ? handleLeaveReview : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {role === 'student' && reviewModalSession && (
        <ReviewModal
          isOpen={!!reviewModalSession}
          onClose={() => setReviewModalSession(null)}
          sessionId={reviewModalSession.id}
          revieweeId={reviewModalSession.providerId}
          reviewerRole="student"
          onReviewSubmitted={() => {
            // Trigger a re-render so cards reflect the new review state immediately.
            setReviewModalSession(null);
          }}
        />
      )}
    </>
  );
}

