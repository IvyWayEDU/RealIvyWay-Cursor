/**
 * Earnings Credits Store
 * 
 * JSON-based storage for earnings credits.
 * Each credit represents earnings credited to a provider for a completed session.
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Credit {
  id: string;
  providerId: string;
  sessionId: string;
  amountCents: number;
  createdAt: string;
}

const CREDITS_FILE = path.join(process.cwd(), 'data', 'earnings-credits.json');
const BALANCES_FILE = path.join(process.cwd(), 'data', 'provider-earnings.json');

type ProviderEarningsBalances = Record<
  string,
  {
    balanceCents: number;
    updatedAt: string;
  }
>;

/**
 * Read all credits from JSON file
 */
export async function readCredits(): Promise<Credit[]> {
  try {
    const data = await fs.readFile(CREDITS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readBalances(): Promise<ProviderEarningsBalances> {
  try {
    const data = await fs.readFile(BALANCES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return (parsed && typeof parsed === 'object') ? (parsed as ProviderEarningsBalances) : {};
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeBalances(balances: ProviderEarningsBalances): Promise<void> {
  const dataDir = path.dirname(BALANCES_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
  await fs.writeFile(BALANCES_FILE, JSON.stringify(balances, null, 2), 'utf-8');
}

/**
 * Write credits to JSON file
 */
async function writeCredits(credits: Credit[]): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(CREDITS_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error: any) {
    // Directory might already exist, ignore error
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  
  await fs.writeFile(CREDITS_FILE, JSON.stringify(credits, null, 2), 'utf-8');
}

/**
 * Check if a credit already exists for a session
 */
export async function creditExistsForSession(sessionId: string): Promise<boolean> {
  const credits = await readCredits();
  return credits.some(credit => credit.sessionId === sessionId);
}

/**
 * Add a credit for a session (idempotent by sessionId)
 * If credit already exists, returns without changing anything.
 */
export async function addCreditForSession(args: {
  providerId: string;
  sessionId: string;
  amountCents: number;
}): Promise<void> {
  const { providerId, sessionId, amountCents } = args;
  
  // Check if credit already exists
  const exists = await creditExistsForSession(sessionId);
  if (exists) {
    console.log('[EARNINGS] already credited', { sessionId });
    return;
  }
  
  // Create new credit
  const credit: Credit = {
    id: `${sessionId}-credit`,
    providerId,
    sessionId,
    amountCents,
    createdAt: new Date().toISOString(),
  };
  
  // Add to credits array
  const credits = await readCredits();
  credits.push(credit);
  await writeCredits(credits);

  // Update provider running earnings balance (persisted).
  // This is idempotent via the creditExistsForSession guard above.
  const balances = await readBalances();
  const nowISO = new Date().toISOString();
  const prev = balances[providerId]?.balanceCents ?? 0;
  balances[providerId] = {
    balanceCents: Math.max(0, Math.floor(prev + Math.max(0, Math.floor(amountCents)))),
    updatedAt: nowISO,
  };
  await writeBalances(balances);
  
  console.log('[EARNINGS] credited session', { sessionId, providerId, amountCents });
}

