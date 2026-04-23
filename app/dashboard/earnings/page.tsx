/**
 * Provider Earnings Page
 * 
 * Displays earnings graph, breakdown, and withdraw functionality.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import ProviderEarningsClient from '@/components/ProviderEarningsClient';
import EarningsDebugPanelClient from '@/components/EarningsDebugPanelClient';
import { isProvider } from '@/lib/auth/authorization';
import { getProviderPayoutSummaryFromLedger } from '@/lib/payouts/summary.server';

export default async function EarningsPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  if (!isProvider(session as any)) {
    redirect('/dashboard/student');
  }

  const providerId = session.userId;
  const payoutSummary = await getProviderPayoutSummaryFromLedger(providerId);

  return (
    <div className="space-y-6">
      <EarningsDebugPanelClient />
      <ProviderEarningsClient
        totalEarningsCents={payoutSummary.totalEarningsCents}
        availableBalanceCents={payoutSummary.availableBalanceCents}
        pendingPayoutsCents={payoutSummary.pendingPayoutsCents ?? payoutSummary.pendingWithdrawalsCents}
        totalWithdrawnCents={payoutSummary.totalWithdrawnCents}
      />
    </div>
  );
}
