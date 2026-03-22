import { promises as fs } from 'fs';
import path from 'path';

// "pending" is the canonical initial status.
// We still accept legacy "pending_admin_review" in storage for backwards compatibility.
export type PayoutRequestStatus =
  | 'pending'
  | 'approved'
  | 'paid'
  | 'rejected'
  // Legacy statuses (kept for backwards compatibility with existing data).
  | 'pending_admin_review'
  | 'processing'
  | 'completed';

export type PayoutAllocation = {
  /**
   * Session/booking id whose provider earnings are being withdrawn.
   * Used for admin auditability and per-booking payment timelines.
   */
  sessionId: string;
  /**
   * Amount (cents) allocated from this session's provider earnings into this payout request.
   * Can be partial for the final session in a payout request.
   */
  amountCents: number;
};

export interface PayoutRequest {
  id: string;
  providerId: string;
  amountCents: number;
  status: PayoutRequestStatus;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  /**
   * Optional allocation breakdown mapping payout amount back to specific sessions.
   * Older records may omit this field.
   */
  allocations?: PayoutAllocation[];
  /**
   * When true, allocations were backfilled/inferred for legacy payout requests.
   * Used for admin audit surfaces so we can clearly distinguish derived mappings.
   */
  allocationsInferred?: boolean;
  /**
   * Snapshot of provider payout destination at time of request.
   * Used for admin payout processing + auditability.
   */
  payoutMethod?: string;
  /**
   * Masked destination string for display in admin tables.
   * Example: "Chase •••• 1234" or "j***@g***.com"
   */
  payoutDestinationMasked?: string;
  /**
   * Legacy field (kept for backwards compatibility with existing JSON data).
   * Historically used for the admin table destination display (sometimes unmasked).
   */
  payoutDestination?: string;

  // Full snapshot fields (admin-only surfaces should show these in the modal).
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankCountry?: string;
  accountHolderName?: string;

  wiseEmail?: string;
  paypalEmail?: string;
  zelleContact?: string;
  // Legacy field (kept for compatibility with existing JSON data).
  stripeTransferId?: string | null;
}

const PAYOUT_REQUESTS_FILE = path.join(process.cwd(), 'data', 'payout-requests.json');

async function readAll(): Promise<PayoutRequest[]> {
  try {
    const raw = await fs.readFile(PAYOUT_REQUESTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PayoutRequest[]) : [];
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      return [];
    }
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
  allocations?: PayoutAllocation[];
  allocationsInferred?: boolean;
  payoutMethod?: string;
  payoutDestinationMasked?: string;
  // Legacy
  payoutDestination?: string;

  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankCountry?: string;
  accountHolderName?: string;

  wiseEmail?: string;
  paypalEmail?: string;
  zelleContact?: string;
}): Promise<PayoutRequest> {
  const amountCents = Math.max(0, Math.floor(Number(args.amountCents || 0)));
  const nowISO = new Date().toISOString();
  const allocations = Array.isArray(args.allocations)
    ? args.allocations
        .map((a) => ({
          sessionId: String((a as any)?.sessionId || '').trim(),
          amountCents: Math.max(0, Math.floor(Number((a as any)?.amountCents || 0))),
        }))
        .filter((a) => a.sessionId && a.amountCents > 0)
    : undefined;
  const pr: PayoutRequest = {
    id: newId(),
    providerId: String(args.providerId || '').trim(),
    amountCents,
    status: 'pending',
    createdAt: nowISO,
    allocations: allocations && allocations.length ? allocations : undefined,
    allocationsInferred: args.allocationsInferred === true ? true : undefined,
    payoutMethod: typeof args.payoutMethod === 'string' ? args.payoutMethod : undefined,
    payoutDestinationMasked: typeof args.payoutDestinationMasked === 'string' ? args.payoutDestinationMasked : undefined,
    payoutDestination: typeof args.payoutDestination === 'string' ? args.payoutDestination : undefined,

    bankName: typeof args.bankName === 'string' ? args.bankName : undefined,
    bankAccountNumber: typeof args.bankAccountNumber === 'string' ? args.bankAccountNumber : undefined,
    bankRoutingNumber: typeof args.bankRoutingNumber === 'string' ? args.bankRoutingNumber : undefined,
    bankCountry: typeof args.bankCountry === 'string' ? args.bankCountry : undefined,
    accountHolderName: typeof args.accountHolderName === 'string' ? args.accountHolderName : undefined,

    wiseEmail: typeof args.wiseEmail === 'string' ? args.wiseEmail : undefined,
    paypalEmail: typeof args.paypalEmail === 'string' ? args.paypalEmail : undefined,
    zelleContact: typeof args.zelleContact === 'string' ? args.zelleContact : undefined,
    stripeTransferId: null,
  };

  const all = await readAll();
  all.push(pr);
  await writeAll(all);
  return pr;
}

export async function updatePayoutRequestAllocations(args: {
  id: string;
  allocations: PayoutAllocation[];
  allocationsInferred?: boolean;
}): Promise<PayoutRequest | null> {
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === args.id);
  if (idx < 0) return null;

  const allocations = Array.isArray(args.allocations)
    ? args.allocations
        .map((a) => ({
          sessionId: String((a as any)?.sessionId || '').trim(),
          amountCents: Math.max(0, Math.floor(Number((a as any)?.amountCents || 0))),
        }))
        .filter((a) => a.sessionId && a.amountCents > 0)
    : [];

  const next: PayoutRequest = {
    ...all[idx],
    allocations: allocations.length ? allocations : undefined,
    allocationsInferred: args.allocationsInferred === true ? true : undefined,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
  return next;
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
    // "Pending" queue = anything not yet marked paid/rejected.
    // Includes legacy statuses for compatibility.
    .filter((r) => {
      const st = String(r.status || '');
      return (
        st === 'pending' ||
        st === 'approved' ||
        st === 'pending_admin_review' ||
        st === 'processing'
      );
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function updatePayoutRequest(
  id: string,
  patch: Partial<Pick<PayoutRequest, 'status' | 'approvedAt' | 'paidAt' | 'stripeTransferId'>> & {
    updatedAt?: string;
  }
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

/**
 * Compare-and-set update for payout requests to prevent double actions.
 * If current status is not in `fromStatuses`, no update occurs.
 */
export async function updatePayoutRequestIfStatus(args: {
  id: string;
  fromStatuses: PayoutRequestStatus[];
  patch: Partial<Pick<PayoutRequest, 'status' | 'approvedAt' | 'paidAt' | 'stripeTransferId'>> & { updatedAt?: string };
}): Promise<{ payoutRequest: PayoutRequest | null; updated: boolean }> {
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === args.id);
  if (idx < 0) return { payoutRequest: null, updated: false };
  const cur = all[idx];
  const curStatus = String(cur.status || '') as PayoutRequestStatus;
  if (!args.fromStatuses.includes(curStatus)) {
    return { payoutRequest: cur, updated: false };
  }
  const next: PayoutRequest = {
    ...cur,
    ...args.patch,
    updatedAt: args.patch.updatedAt || new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
  return { payoutRequest: next, updated: true };
}

export async function updatePayoutRequestSnapshot(
  id: string,
  patch: Partial<
    Pick<
      PayoutRequest,
      | 'payoutMethod'
      | 'payoutDestinationMasked'
      | 'payoutDestination'
      | 'bankName'
      | 'bankAccountNumber'
      | 'bankRoutingNumber'
      | 'bankCountry'
      | 'accountHolderName'
      | 'wiseEmail'
      | 'paypalEmail'
      | 'zelleContact'
    >
  >
): Promise<PayoutRequest | null> {
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const next: PayoutRequest = {
    ...all[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function getProviderPayoutRequestTotals(providerId: string): Promise<{
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  withdrawnCents: number;
}> {
  const all = await listProviderPayoutRequests(providerId);
  const pendingCents = all.filter((r) => {
    const st = String(r.status || '');
    return st === 'pending' || st === 'pending_admin_review';
  }).reduce((sum, r) => sum + Number(r.amountCents || 0), 0);

  // Treat legacy "processing" as "approved" for totals/reservation purposes.
  const approvedCents = all.filter((r) => {
    const st = String(r.status || '');
    return st === 'approved' || st === 'processing';
  }).reduce((sum, r) => sum + Number(r.amountCents || 0), 0);

  // Treat legacy "completed" as "paid" for totals.
  const paidCents = all.filter((r) => {
    const st = String(r.status || '');
    return st === 'paid' || st === 'completed';
  }).reduce((sum, r) => sum + Number(r.amountCents || 0), 0);

  const withdrawnCents = paidCents;
  return {
    pendingCents: Math.max(0, Math.floor(pendingCents)),
    approvedCents: Math.max(0, Math.floor(approvedCents)),
    paidCents: Math.max(0, Math.floor(paidCents)),
    withdrawnCents: Math.max(0, Math.floor(withdrawnCents)),
  };
}


