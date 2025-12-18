'use client';

import { useState, useEffect } from 'react';
import { Session } from '@/lib/models/types';
import { getDevSessions } from '@/lib/devSessionStore';

interface SessionDebugPanelProps {
  userRole: 'student' | 'provider';
}

/**
 * Temporary Debug Panel
 * 
 * Shows raw session objects being stored for debugging purposes.
 * Only visible in development mode.
 * 
 * Displays:
 * - id
 * - studentId
 * - providerId
 * - status
 * - date (from scheduledStartTime)
 * - time (from scheduledStartTime)
 * - sessionType
 */
export default function SessionDebugPanel({ userRole }: SessionDebugPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDevelopment, setIsDevelopment] = useState(true); // Default to true, will be set in useEffect

  useEffect(() => {
    // Only show in development
    // In Next.js, process.env.NODE_ENV is available in client components
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
    setIsDevelopment(isDev);
  }, []);

  useEffect(() => {
    if (!isDevelopment) return;

    const fetchSessions = () => {
      setLoading(true);
      try {
        // Get all sessions from getDevSessions
        const allSessions = getDevSessions();
        setSessions(allSessions);
      } catch (error) {
        console.error('Error fetching sessions for debug:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    
    // Refresh every second to catch updates
    const interval = setInterval(fetchSessions, 1000);
    return () => clearInterval(interval);
  }, [isDevelopment]);

  // Don't render in production
  if (!isDevelopment) {
    return null;
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-red-900">
          🔍 TEMP DEBUG PANEL (Development Only)
        </h3>
        <span className="text-xs font-medium text-red-700 bg-red-200 px-2 py-1 rounded">
          {userRole === 'student' ? 'STUDENT VIEW' : 'PROVIDER VIEW'}
        </span>
      </div>
      <p className="text-sm text-red-800 mb-4">
        Raw session objects from storage. Check that providerId is populated and matches provider user id.
      </p>
      
      {loading ? (
        <div className="text-sm text-red-700">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-red-700 font-medium">
          ⚠️ No sessions found in storage
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-red-900">
            Found {sessions.length} session(s):
          </div>
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className="bg-white border border-red-200 rounded p-3 font-mono text-xs"
            >
              <div className="font-bold text-red-900 mb-2">Session #{index + 1}</div>
              <div className="space-y-1 text-gray-800">
                <div>
                  <span className="font-semibold">id:</span>{' '}
                  <span className="text-blue-700">{session.id}</span>
                </div>
                <div>
                  <span className="font-semibold">studentId:</span>{' '}
                  <span className={session.studentId ? 'text-green-700' : 'text-red-700'}>
                    {session.studentId || '❌ MISSING'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">providerId:</span>{' '}
                  <span className={session.providerId ? 'text-green-700' : 'text-red-700'}>
                    {session.providerId || '❌ MISSING'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">status:</span>{' '}
                  <span className="text-purple-700">{session.status}</span>
                </div>
                <div>
                  <span className="font-semibold">date:</span>{' '}
                  <span className="text-indigo-700">
                    {formatDate(session.scheduledStartTime)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">time:</span>{' '}
                  <span className="text-indigo-700">
                    {formatTime(session.scheduledStartTime)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">sessionType:</span>{' '}
                  <span className="text-teal-700">{session.sessionType}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

