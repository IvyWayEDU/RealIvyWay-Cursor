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
import { getFirstName } from '@/lib/auth/displayName';
import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';
import { getProviderByUserId } from '@/lib/providers/storage';
import UpcomingSessionsSection from '@/components/UpcomingSessionsSection';
import ProviderEarningsSnapshotClient from '@/components/ProviderEarningsSnapshotClient';
import IvyWayAICard from '@/components/IvyWayAICard';
import MessagesSection from '@/components/MessagesSection';
import ProviderAvailabilityPrompt from '@/components/ProviderAvailabilityPrompt';

function providerHasAnyAvailability(provider: any | null | undefined): boolean {
  const raw = provider && typeof provider === 'object' ? (provider as any).availability : null;
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length === 0) return false;
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue;
    const blocks = Array.isArray((entry as any).blocks) ? (entry as any).blocks : [];
    const days = Array.isArray((entry as any).days) ? (entry as any).days : [];
    if (blocks.length > 0 || days.length > 0) return true;
  }
  return false;
}

export default async function ProviderDashboard() {
  // Verify session exists
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  if (!Array.isArray(session.roles) || session.roles.length === 0) {
    redirect('/onboarding/role');
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

  const [earnings, provider] = await Promise.all([
    getProviderEarningsSummary(session.userId),
    getProviderByUserId(session.userId).catch(() => null),
  ]);

  const dismissedAt = (onboardingStatus.user as any)?.availabilityPromptDismissedAt;
  const dismissed = typeof dismissedAt === 'string' ? dismissedAt.trim().length > 0 : Boolean(dismissedAt);
  const hasAvailability = providerHasAnyAvailability(provider);
  const shouldShowAvailabilityPrompt = !dismissed && !hasAvailability;
  const firstName = getFirstName(session.name);

  return (
    <div className="space-y-8">
      <ProviderAvailabilityPrompt show={shouldShowAvailabilityPrompt} />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back
            {firstName ? (
              <>
                , <span className="text-[#0088CB]">{firstName}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your sessions and track your earnings.
          </p>
        </div>
        <Link
          href="/dashboard/availability"
          className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 sm:py-2.5 bg-[#0088CB] text-white font-medium rounded-md hover:bg-[#0077B3] transition-colors"
        >
          Manage Availability
        </Link>
      </div>

      {/* 2x2 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Left: Upcoming Sessions */}
        <div>
          <UpcomingSessionsSection />
        </div>

        {/* Top Right: Earnings Snapshot */}
        <div>
          <ProviderEarningsSnapshotClient
            initialTotalEarningsCents={earnings.totalEarningsCents}
            initialAvailableBalanceCents={earnings.availableBalanceCents}
            initialPendingPayoutsCents={earnings.pendingPayoutsCents}
            initialTotalWithdrawnCents={earnings.totalWithdrawnCents}
          />
        </div>

        {/* Bottom Left: IvyWay AI */}
        <div>
          <IvyWayAICard />
        </div>

        {/* Bottom Right: Messages */}
        <div>
          <MessagesSection
            userId={session.userId}
            subtitle="Chat with your students"
            emptySubtitle="Start a conversation with your students"
          />
        </div>
      </div>
    </div>
  );
}
