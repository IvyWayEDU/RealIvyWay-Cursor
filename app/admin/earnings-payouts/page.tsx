import { getUsers } from '@/lib/auth/storage';
import { getSessions } from '@/lib/sessions/storage';
import { readCredits } from '@/lib/earnings/credits.server';
import AdminEarningsClient from '@/components/admin/AdminEarningsClient';
import { readFile } from 'fs/promises';
import path from 'path';
import { listPendingPayoutRequests } from '@/lib/payouts/payout-requests.server';

async function readBankAccounts(): Promise<any[]> {
  try {
    const p = path.join(process.cwd(), 'data', 'bank-accounts.json');
    const raw = await readFile(p, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readProviderEarningsBalances(): Promise<Record<string, { balanceCents: number; updatedAt: string }>> {
  try {
    const p = path.join(process.cwd(), 'data', 'provider-earnings.json');
    const raw = await readFile(p, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as any) : {};
  } catch {
    return {};
  }
}

export default async function AdminEarningsPayoutsPage() {
  const [users, sessions, credits, bankAccounts, balances, payoutRequests] = await Promise.all([
    getUsers(),
    getSessions(),
    readCredits(),
    readBankAccounts(),
    readProviderEarningsBalances(),
    listPendingPayoutRequests(),
  ]);

  return (
    <AdminEarningsClient
      initialUsers={users as any}
      initialSessions={sessions as any}
      initialCredits={credits as any}
      initialBankAccounts={bankAccounts as any}
      initialBalances={balances as any}
      initialPayoutRequests={payoutRequests as any}
    />
  );
}


