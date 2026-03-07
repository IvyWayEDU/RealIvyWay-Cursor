/**
 * Withdrawal Request Page
 * 
 * Allows providers to request withdrawals of their earnings.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { isProvider } from '@/lib/auth/authorization';
import WithdrawEarningsClient from '@/components/WithdrawEarningsClient';
import { getProviderByUserId } from '@/lib/providers/storage';
import { getProviderPayoutSummaryFromLedger } from '@/lib/payouts/summary.server';

export default async function WithdrawPage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  if (!isProvider(session as any)) redirect('/dashboard/student');

  const providerId = session.userId;
  const [provider, payoutSummary] = await Promise.all([
    getProviderByUserId(providerId),
    getProviderPayoutSummaryFromLedger(providerId),
  ]);
  const stripeConnectAccountId = String((provider as any)?.stripeConnectAccountId || '').trim();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Withdraw Earnings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Request a withdrawal of your available earnings.
        </p>
      </div>

      <WithdrawEarningsClient
        availableBalanceCents={payoutSummary.availableBalanceCents}
        pendingPayoutsCents={payoutSummary.pendingPayoutsCents ?? payoutSummary.pendingWithdrawalsCents}
        totalWithdrawnCents={payoutSummary.totalWithdrawnCents}
        stripeConnected={Boolean(stripeConnectAccountId)}
      />
    </div>
  );
}

