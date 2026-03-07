'use client';

import { useState } from 'react';
import { Session } from '@/lib/models/types';

interface ProviderNoShowSectionProps {
  initialSessions?: Session[];
  userNames?: Record<string, string>;
}

export default function ProviderNoShowSection({ initialSessions = [], userNames = {} }: ProviderNoShowSectionProps) {
  const [sessions] = useState<Session[]>(initialSessions);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (sessions.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Flagged Sessions</h2>
        </div>
        <div className="p-6">
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No flagged sessions</h3>
            <p className="mt-1 text-sm text-gray-500">
              No sessions are currently flagged.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Flagged Sessions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sessions where providers did not join within 10 minutes of start time
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Session Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zoom Join Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>{formatDate(session.scheduledStartTime)}</div>
                  {(session as any).flaggedAt && (
                    <div className="text-xs text-gray-500">
                      Marked: {formatDate((session as any).flaggedAt)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {userNames[session.providerId] || 'Provider'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {userNames[session.studentId] || 'Student'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="space-y-1">
                    {session.providerJoinedAt ? (
                      <div className="text-red-600">
                        ❌ Joined late: {formatDate(session.providerJoinedAt)}
                      </div>
                    ) : (
                      <div className="text-red-600 font-medium">
                        ❌ Provider never joined Zoom
                      </div>
                    )}
                    {session.providerJoinTime && (
                      <div className="text-xs">
                        Join: {formatDate(session.providerJoinTime)}
                      </div>
                    )}
                    {session.providerLeaveTime && (
                      <div className="text-xs">
                        Leave: {formatDate(session.providerLeaveTime)}
                      </div>
                    )}
                    {session.providerDurationSeconds !== undefined && (
                      <div className="text-xs">
                        Duration: {Math.floor(session.providerDurationSeconds / 60)} min {session.providerDurationSeconds % 60} sec
                      </div>
                    )}
                    {session.providerAccumulatedSeconds !== undefined && (
                      <div className="text-xs">
                        Total: {Math.floor(session.providerAccumulatedSeconds / 60)} min {session.providerAccumulatedSeconds % 60} sec
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    Flagged
                  </span>
                  <div className="mt-1 text-xs text-gray-500">
                    Session did not complete
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    No payout issued
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

