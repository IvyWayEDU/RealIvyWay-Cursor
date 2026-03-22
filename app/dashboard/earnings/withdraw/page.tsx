/**
 * Withdrawal Request Page
 * 
 * Allows providers to request withdrawals of their earnings.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { isProvider } from '@/lib/auth/authorization';
import WithdrawFormClient from '@/components/WithdrawFormClient';
import { getProviderPayoutSummaryFromLedger } from '@/lib/payouts/summary.server';
import { getBankAccount } from '@/lib/payouts/bank-account-storage';

export default async function WithdrawPage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  if (!isProvider(session as any)) redirect('/dashboard/student');

  const providerId = session.userId;
  const [payoutSummary, bankAccount] = await Promise.all([
    getProviderPayoutSummaryFromLedger(providerId),
    getBankAccount(providerId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Withdraw Earnings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Request a withdrawal of your available earnings.
        </p>
      </div>

      <WithdrawFormClient
        availableBalanceCents={payoutSummary.availableBalanceCents}
        bankAccount={bankAccount}
      />
    </div>
  );
}

