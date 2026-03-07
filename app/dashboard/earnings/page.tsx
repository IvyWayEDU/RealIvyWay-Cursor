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
import { getProviderByUserId } from '@/lib/providers/storage';
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
  const [provider, payoutSummary] = await Promise.all([
    getProviderByUserId(providerId),
    getProviderPayoutSummaryFromLedger(providerId),
  ]);
  const stripeConnectAccountId = String((provider as any)?.stripeConnectAccountId || '').trim();

  return (
    <div className="space-y-8">
      <EarningsDebugPanelClient />
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track your earnings and manage payouts.
        </p>
      </div>
      <ProviderEarningsClient
        totalEarningsCents={payoutSummary.totalEarningsCents}
        availableBalanceCents={payoutSummary.availableBalanceCents}
        pendingPayoutsCents={payoutSummary.pendingPayoutsCents ?? payoutSummary.pendingWithdrawalsCents}
        totalWithdrawnCents={payoutSummary.totalWithdrawnCents}
        stripeConnected={Boolean(stripeConnectAccountId)}
      />
    </div>
  );
}
