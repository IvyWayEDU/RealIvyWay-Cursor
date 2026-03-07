import { promises as fs } from 'fs';
import path from 'path';

// "pending" is the canonical initial status.
// We still accept legacy "pending_admin_review" in storage for backwards compatibility.
export type PayoutRequestStatus = 'pending' | 'pending_admin_review' | 'processing' | 'completed' | 'rejected';

export interface PayoutRequest {
  id: string;
  providerId: string;
  amountCents: number;
  status: PayoutRequestStatus;
  createdAt: string;
  updatedAt?: string;
  stripeTransferId?: string | null;
}

const PAYOUT_REQUESTS_FILE = path.join(process.cwd(), 'data', 'payout-requests.json');

async function readAll(): Promise<PayoutRequest[]> {
  try {
    const raw = await fs.readFile(PAYOUT_REQUESTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PayoutRequest[]) : [];
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAll(requests: PayoutRequest[]): Promise<void> {
  const dataDir = path.dirname(PAYOUT_REQUESTS_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(PAYOUT_REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
}

function newId(): string {
  return `payoutreq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createPayoutRequest(args: {
  providerId: string;
  amountCents: number;
}): Promise<PayoutRequest> {
  const amountCents = Math.max(0, Math.floor(Number(args.amountCents || 0)));
  const nowISO = new Date().toISOString();
  const pr: PayoutRequest = {
    id: newId(),
    providerId: String(args.providerId || '').trim(),
    amountCents,
    status: 'pending',
    createdAt: nowISO,
    stripeTransferId: null,
  };

  const all = await readAll();
  all.push(pr);
  await writeAll(all);
  return pr;
}

export async function getPayoutRequestById(id: string): Promise<PayoutRequest | null> {
  const all = await readAll();
  return all.find((r) => r.id === id) || null;
}

export async function listProviderPayoutRequests(providerId: string): Promise<PayoutRequest[]> {
  const all = await readAll();
  return all
    .filter((r) => r.providerId === providerId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function listAllPayoutRequests(): Promise<PayoutRequest[]> {
  const all = await readAll();
  return all.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function listPendingPayoutRequests(): Promise<PayoutRequest[]> {
  const all = await readAll();
  return all
    .filter((r) => r.status === 'pending' || r.status === 'pending_admin_review' || r.status === 'processing')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function updatePayoutRequest(
  id: string,
  patch: Partial<Pick<PayoutRequest, 'status' | 'stripeTransferId'>> & { updatedAt?: string }
): Promise<PayoutRequest | null> {
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next: PayoutRequest = {
    ...all[idx],
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function getProviderPayoutRequestTotals(providerId: string): Promise<{
  pendingCents: number;
  withdrawnCents: number;
}> {
  const all = await listProviderPayoutRequests(providerId);
  const pendingCents = all
    .filter((r) => r.status === 'pending' || r.status === 'pending_admin_review' || r.status === 'processing')
    .reduce((sum, r) => sum + Number(r.amountCents || 0), 0);
  const withdrawnCents = all
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + Number(r.amountCents || 0), 0);
  return {
    pendingCents: Math.max(0, Math.floor(pendingCents)),
    withdrawnCents: Math.max(0, Math.floor(withdrawnCents)),
  };
}


