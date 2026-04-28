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

  if (!Array.isArray((session as any).roles) || (session as any).roles.length === 0) {
    redirect('/onboarding/role');
  }

  if (!isProvider(session as any)) redirect('/dashboard/student');

  const providerId = session.userId;
  const [payoutSummary, bankAccount] = await Promise.all([
    getProviderPayoutSummaryFromLedger(providerId),
    getBankAccount(providerId),
  ]);

  return (
    <div className="min-h-0">
      <WithdrawFormClient
        availableBalanceCents={payoutSummary.availableBalanceCents}
        bankAccount={bankAccount}
      />
    </div>
  );
}

