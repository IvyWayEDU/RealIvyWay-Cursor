'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@/lib/models/types';
import { formatServiceTypeLabel, getCanonicalServiceType, getCanonicalTopicLabel } from '@/lib/sessions/sessionDisplay';
import ZoomJoinModal from './ZoomJoinModal';
import { getSessionStartTimeMs } from '@/lib/sessions/uiHelpers';
import { isSessionCompleted, isSessionUpcoming } from '@/lib/sessions/lifecycle';

export default function UpcomingSessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinConfirm, setJoinConfirm] = useState<{ joinUrl: string; sessionId: string } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastJsonRef = useRef<string>('');
  const didInitialLoadRef = useRef<boolean>(false);
  const router = useRouter();

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

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sessions/all?role=provider', { method: 'GET' });
        if (!res.ok) {
          if (!didInitialLoadRef.current) setSessions([]);
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
        const upcoming = all
          .filter((s) => isSessionUpcoming(s, nowMs) && !isSessionCompleted(s, nowMs))
          .sort((a, b) => getStartMs(a) - getStartMs(b));

        const nextStr = JSON.stringify(upcoming);
        if (nextStr !== lastJsonRef.current) {
          lastJsonRef.current = nextStr;
          setSessions(upcoming as Session[]);
        }
      } catch (error) {
        console.error('Error fetching upcoming sessions:', error);
        if (!didInitialLoadRef.current) setSessions([]);
      } finally {
        if (!didInitialLoadRef.current) {
          didInitialLoadRef.current = true;
          setLoading(false);
        }
      }
    };

    fetchSessions().catch(() => {});
    
    // Refresh periodically to catch webhook updates
    const interval = setInterval(fetchSessions, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStartIso = (s: any) => s?.startTime || s?.scheduledStartTime || s?.scheduledStart;
  const getEndIso = (s: any) => s?.endTime || s?.scheduledEndTime || s?.scheduledEnd;
  // Per spec: always navigate to session.zoomJoinUrl when available (participants join link).
  // Keep legacy fallbacks for older/dev sessions.
  const getJoinUrl = (s: any): string | null =>
    (typeof s?.zoomJoinUrl === 'string' && s.zoomJoinUrl.trim().length > 0
      ? s.zoomJoinUrl
      : typeof s?.meetingUrl === 'string' && s.meetingUrl.trim().length > 0
        ? s.meetingUrl
        : typeof s?.zoomUrl === 'string' && s.zoomUrl.trim().length > 0
          ? s.zoomUrl
          : typeof s?.joinUrl === 'string' && s.joinUrl.trim().length > 0
            ? s.joinUrl
            : null);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Upcoming Sessions</h2>
        <p className="mt-1 text-sm text-gray-500">
          Confirmed sessions with students
        </p>
      </div>
      <div className="p-6 min-h-[220px]">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-sm text-gray-500">Loading upcoming sessions...</p>
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No upcoming sessions
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Your confirmed sessions will appear here after students complete payment.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[520px] overflow-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-blue-200 rounded-lg p-4 bg-blue-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                        Upcoming
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
                    {session.studentId && (
                      <div className="mb-2 flex items-center gap-2 text-sm">
                        <UserAvatar
                          name={String((session as any)?.studentName || '')}
                          imageUrl={(session as any)?.studentProfileImage ?? null}
                        />
                        <span className="font-medium text-gray-900">
                          {String((session as any)?.studentName || '')}
                        </span>
                      </div>
                    )}
                    {(() => {
                      const subjectRaw = (session as any)?.subject;
                      const topicRaw = (session as any)?.topic;
                      const subject = typeof subjectRaw === 'string' && subjectRaw.trim() ? subjectRaw.trim() : '';
                      const topic = typeof topicRaw === 'string' && topicRaw.trim() ? topicRaw.trim() : '';
                      if (!subject && !topic) return null;
                      return (
                        <div className="space-y-0.5">
                          {subject && (
                            <div className="text-sm text-gray-700">{`${formatServiceTypeLabel(getCanonicalServiceType(session))} • ${subject}`}</div>
                          )}
                          {topic && <span className="text-sm text-gray-600">Topic: {topic}</span>}
                        </div>
                      );
                    })()}
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
                          {formatDate(new Date(getStartIso(session)))}
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
                        {(() => {
                          const start = getStartIso(session) ? new Date(getStartIso(session)) : null;
                          const end = getEndIso(session) ? new Date(getEndIso(session)) : null;
                          const ok =
                            !!start &&
                            !!end &&
                            Number.isFinite(start.getTime()) &&
                            Number.isFinite(end.getTime());
                          if (!ok) return <span>—</span>;
                          return <span>{`${formatTime(start)} - ${formatTime(end)}`}</span>;
                        })()}
                      </div>
                    </div>
                    {/* Join flow is handled via the Join Session button (confirm modal required). */}
                  </div>
                  <div className="flex sm:justify-end">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          const otherUserId = typeof (session as any)?.studentId === 'string' ? (session as any).studentId : '';
                          if (!otherUserId) return;
                          router.push(`/dashboard/messages?userId=${encodeURIComponent(otherUserId)}`);
                        }}
                        disabled={!session.studentId}
                        className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                          session.studentId
                            ? 'border-[#0088CB] text-[#0088CB] bg-white hover:bg-[#0088CB]/5'
                            : 'border-gray-200 text-gray-400 bg-white cursor-not-allowed'
                        }`}
                      >
                        Message
                      </button>

                      {(() => {
                        const joinUrl = getJoinUrl(session as any);
                        const startTimeMs = getSessionStartTimeMs(session as any) ?? NaN;
                        const canJoinSession = Number.isFinite(startTimeMs) ? nowMs >= startTimeMs : false;
                        return (
                          <button
                            type="button"
                            disabled={!canJoinSession}
                            onClick={() => {
                              if (!joinUrl) return;
                              // Early clicks are blocked via disabled button only.
                              setJoinConfirm({ joinUrl, sessionId: session.id });
                            }}
                            className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              canJoinSession
                                ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                            title="Join Session"
                          >
                            Join Session
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {joinConfirm && (
        <ZoomJoinModal
          isOpen={!!joinConfirm}
          onClose={() => setJoinConfirm(null)}
          message="Please allow up to 10 minutes for the student to join"
          confirmLabel="Join Zoom Session"
          onConfirm={async () => {
            const { joinUrl, sessionId } = joinConfirm;
            setJoinConfirm(null);
            // Best-effort: record provider join, but do not block redirect after confirmation.
            try {
              await fetch('/api/sessions/track-provider-join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });
            } catch {}
            window.location.href = joinUrl;
          }}
        />
      )}
    </div>
  );
}

