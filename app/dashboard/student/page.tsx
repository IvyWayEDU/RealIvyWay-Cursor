/**
 * Student Dashboard
 * 
 * Clean UI-only layout with placeholder sections.
 * No booking logic, payments, AI, or API calls.
 */

import Link from 'next/link';
import CompletedSessionsSection from '@/components/dashboard/CompletedSessionsSection';
import AIProblemSolver from '@/components/AIProblemSolver';
import MessagesSection from '@/components/MessagesSection';

export default function StudentDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your sessions and track your progress.
          </p>
        </div>
        <Link
          href="/dashboard/book"
          className="px-6 py-2.5 bg-[#0088CB] text-white font-medium rounded-md hover:bg-[#0077B3] transition-colors"
        >
          Book a new session
        </Link>
      </div>

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
            <h2 className="text-xl font-semibold text-gray-900">Upcoming Sessions</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Your confirmed sessions
          </p>
        </div>
        <div className="p-6">
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming sessions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your confirmed sessions will appear here.
            </p>
          </div>
        </div>
      </div>

      {/* Completed Sessions and AI Problem Solver - 50/50 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completed Sessions Section - 50% width */}
        <div className="lg:col-span-1">
          <CompletedSessionsSection />
        </div>

        {/* AI Problem Solver and Messages - 50% width, stacked */}
        <div className="lg:col-span-1 space-y-6">
          <AIProblemSolver />
          <MessagesSection />
        </div>
      </div>

    </div>
  );
}
