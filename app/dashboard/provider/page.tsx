/**
 * Provider Dashboard (Tutor/Counselor)
 * 
 * Clean UI-only layout with placeholder sections.
 * No booking logic, payments, AI, or API calls.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getOnboardingStatus } from '@/lib/auth/onboarding';
import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';
import UpcomingSessionsSection from '@/components/UpcomingSessionsSection';
import DevClearSessionsButton from '@/components/DevClearSessionsButton';
import ProviderEarningsSnapshotClient from '@/components/ProviderEarningsSnapshotClient';

export default async function ProviderDashboard() {
  // Verify session exists
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  // Check if user is a provider
  const isProvider = session.roles.includes('provider');
  if (!isProvider) {
    redirect('/dashboard/student');
  }

  // Check if onboarding is completed - if not, redirect to onboarding
  const onboardingStatus = await getOnboardingStatus();
  if (!onboardingStatus.completed) {
    redirect('/onboarding/provider');
  }

  const earnings = await getProviderEarningsSummary(session.userId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your sessions and track your earnings.
          </p>
        </div>
        <Link
          href="/dashboard/availability"
          className="px-6 py-2.5 bg-[#0088CB] text-white font-medium rounded-md hover:bg-[#0077B3] transition-colors"
        >
          Manage Availability
        </Link>
      </div>

      {/* Dev tools */}
      <DevClearSessionsButton />

      {/* Upcoming Sessions Section */}
      <UpcomingSessionsSection />

      {/* Messages and Earnings Snapshot - 50/50 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Section - 50% width */}
        <div className="lg:col-span-1">
          <Link
            href="/dashboard/messages"
            className="block overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-[#0088CB]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Chat with your students
                  </p>
                </div>
              </div>
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start a conversation with your students
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Earnings Snapshot Section - 50% width */}
        <div className="lg:col-span-1">
          <ProviderEarningsSnapshotClient
            initialTotalEarningsCents={earnings.totalEarningsCents}
            initialAvailableBalanceCents={earnings.availableBalanceCents}
            initialPendingPayoutsCents={earnings.pendingPayoutsCents}
            initialTotalWithdrawnCents={earnings.totalWithdrawnCents}
          />
        </div>
      </div>
    </div>
  );
}
