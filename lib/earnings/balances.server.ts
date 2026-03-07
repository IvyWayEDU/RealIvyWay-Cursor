import { promises as fs } from 'fs';
import path from 'path';

export type ProviderEarningsBalances = Record<
  string,
  {
    balanceCents: number;
    updatedAt: string;
  }
>;

const BALANCES_FILE = path.join(process.cwd(), 'data', 'provider-earnings.json');

async function readBalances(): Promise<ProviderEarningsBalances> {
  try {
    const raw = await fs.readFile(BALANCES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProviderEarningsBalances) : {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeBalances(balances: ProviderEarningsBalances): Promise<void> {
  const dataDir = path.dirname(BALANCES_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(BALANCES_FILE, JSON.stringify(balances, null, 2), 'utf-8');
}

export async function getProviderEarningsBalanceCents(providerId: string): Promise<number> {
  const balances = await readBalances();
  const cents = balances[providerId]?.balanceCents ?? 0;
  return Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
}

export async function debitProviderEarningsBalanceCents(providerId: string, amountCents: number): Promise<number> {
  const amt = Math.max(0, Math.floor(Number(amountCents || 0)));
  const balances = await readBalances();
  const prev = balances[providerId]?.balanceCents ?? 0;
  const next = Math.max(0, Math.floor(prev) - amt);
  balances[providerId] = { balanceCents: next, updatedAt: new Date().toISOString() };
  await writeBalances(balances);
  return next;
}


