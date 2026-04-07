import path from 'path';

export type ProviderEarningsBalances = Record<
  string,
  {
    balanceCents: number;
    updatedAt: string;
  }
>;

const BALANCES_FILE = path.join(process.cwd(), 'data', 'provider-earnings.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

async function readBalances(): Promise<ProviderEarningsBalances> {
  if (FS_DISABLED_IN_PROD) return {};
  try {
    const fsp = await import('fs/promises');
    const raw = await fsp.readFile(BALANCES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProviderEarningsBalances) : {};
  } catch {
    return {};
  }
}

async function writeBalances(balances: ProviderEarningsBalances): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dataDir = path.dirname(BALANCES_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.writeFile(BALANCES_FILE, JSON.stringify(balances, null, 2), 'utf-8');
  } catch {
    return;
  }
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


