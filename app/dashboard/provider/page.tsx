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
import ProviderEarningsSnapshotClient from '@/components/ProviderEarningsSnapshotClient';
import IvyWayAICard from '@/components/IvyWayAICard';
import MessagesSection from '@/components/MessagesSection';

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

      <IvyWayAICard
        entryPoint="provider_dashboard"
        description="Use AI to generate study materials, quizzes, explanations, and prep for tutoring sessions."
      />

      {/* Upcoming Sessions Section */}
      <UpcomingSessionsSection />

      {/* Messages and Earnings Snapshot - 50/50 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Section - 50% width */}
        <div className="lg:col-span-1">
          <MessagesSection
            userId={session.userId}
            subtitle="Chat with your students"
            emptySubtitle="Start a conversation with your students"
          />
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
