import path from 'path';
import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

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

type PayoutRequestRow = {
  id: string | null;
  provider_id: string | null;
  amount_cents: number | null;
  status: string | null;
  allocations: any | null;
  allocations_inferred: boolean | null;
  payout_method: string | null;
  payout_destination_masked: string | null;
  payout_destination: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  bank_country: string | null;
  account_holder_name: string | null;
  wise_email: string | null;
  paypal_email: string | null;
  zelle_contact: string | null;
  stripe_transfer_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function hasSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function toCents(v: unknown): number {
  const n = Math.floor(Number(v || 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeStatus(v: unknown): PayoutRequestStatus {
  const st = String(v || '').trim() as PayoutRequestStatus;
  // If unknown status appears in DB, default to pending (safest reservation semantics).
  const allowed = new Set<PayoutRequestStatus>([
    'pending',
    'approved',
    'paid',
    'rejected',
    'pending_admin_review',
    'processing',
    'completed',
  ]);
  return allowed.has(st) ? st : 'pending';
}

function rowToPayoutRequest(row: PayoutRequestRow): PayoutRequest {
  const nowISO = new Date().toISOString();
  const allocations = Array.isArray(row?.allocations) ? (row.allocations as any[]) : undefined;
  return {
    id: String(row?.id || '').trim(),
    providerId: String(row?.provider_id || '').trim(),
    amountCents: toCents(row?.amount_cents),
    status: normalizeStatus(row?.status),
    createdAt: String(row?.created_at || nowISO),
    updatedAt: row?.updated_at ? String(row.updated_at) : undefined,
    approvedAt: row?.approved_at ? String(row.approved_at) : undefined,
    paidAt: row?.paid_at ? String(row.paid_at) : undefined,
    allocations: allocations && allocations.length ? (allocations as any) : undefined,
    allocationsInferred: row?.allocations_inferred === true ? true : undefined,
    payoutMethod: typeof row?.payout_method === 'string' ? row.payout_method : undefined,
    payoutDestinationMasked:
      typeof row?.payout_destination_masked === 'string' ? row.payout_destination_masked : undefined,
    payoutDestination: typeof row?.payout_destination === 'string' ? row.payout_destination : undefined,
    bankName: typeof row?.bank_name === 'string' ? row.bank_name : undefined,
    bankAccountNumber: typeof row?.bank_account_number === 'string' ? row.bank_account_number : undefined,
    bankRoutingNumber: typeof row?.bank_routing_number === 'string' ? row.bank_routing_number : undefined,
    bankCountry: typeof row?.bank_country === 'string' ? row.bank_country : undefined,
    accountHolderName: typeof row?.account_holder_name === 'string' ? row.account_holder_name : undefined,
    wiseEmail: typeof row?.wise_email === 'string' ? row.wise_email : undefined,
    paypalEmail: typeof row?.paypal_email === 'string' ? row.paypal_email : undefined,
    zelleContact: typeof row?.zelle_contact === 'string' ? row.zelle_contact : undefined,
    stripeTransferId: row?.stripe_transfer_id ?? null,
  };
}

async function readAll(): Promise<PayoutRequest[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('payout_requests').select('*');
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as any as PayoutRequestRow[]) : [];
    return rows.map(rowToPayoutRequest);
  }
  try {
    const fsp = await import('fs/promises');
    const raw = await fsp.readFile(PAYOUT_REQUESTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PayoutRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(requests: PayoutRequest[]): Promise<void> {
  // NOTE: Supabase-backed storage does not use writeAll. Keep FS behavior for local fallback only.
  if (hasSupabaseConfigured()) return;
  const dataDir = path.dirname(PAYOUT_REQUESTS_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.writeFile(PAYOUT_REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
  } catch {
    return;
  }
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

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const insertRow: any = {
      id: pr.id,
      provider_id: pr.providerId,
      amount_cents: pr.amountCents,
      status: pr.status,
      allocations: pr.allocations ? (pr.allocations as any) : null,
      allocations_inferred: pr.allocationsInferred === true ? true : null,
      payout_method: pr.payoutMethod ?? null,
      payout_destination_masked: pr.payoutDestinationMasked ?? null,
      payout_destination: pr.payoutDestination ?? null,
      bank_name: pr.bankName ?? null,
      bank_account_number: pr.bankAccountNumber ?? null,
      bank_routing_number: pr.bankRoutingNumber ?? null,
      bank_country: pr.bankCountry ?? null,
      account_holder_name: pr.accountHolderName ?? null,
      wise_email: pr.wiseEmail ?? null,
      paypal_email: pr.paypalEmail ?? null,
      zelle_contact: pr.zelleContact ?? null,
      // created_at/updated_at handled by DB defaults/triggers
    };
    // Avoid hard-failing inserts if the column hasn't been migrated yet.
    if (typeof pr.stripeTransferId === 'string') insertRow.stripe_transfer_id = pr.stripeTransferId;

    const { data, error } = await supabase
      .from('payout_requests')
      .insert(insertRow)
      .select('*')
      .single();
    if (error) throw error;
    return rowToPayoutRequest(data as any);
  }

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
  const allocations = Array.isArray(args.allocations)
    ? args.allocations
        .map((a) => ({
          sessionId: String((a as any)?.sessionId || '').trim(),
          amountCents: Math.max(0, Math.floor(Number((a as any)?.amountCents || 0))),
        }))
        .filter((a) => a.sessionId && a.amountCents > 0)
    : [];

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('payout_requests')
      .update({
        allocations: allocations.length ? (allocations as any) : null,
        allocations_inferred: args.allocationsInferred === true ? true : null,
      } as any)
      .eq('id', String(args.id || '').trim())
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPayoutRequest(data as any) : null;
  }

  const all = await readAll();
  const idx = all.findIndex((r) => r.id === args.id);
  if (idx < 0) return null;
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
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('payout_requests').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToPayoutRequest(data as any) : null;
  }
  const all = await readAll();
  return all.find((r) => r.id === id) || null;
}

export async function listProviderPayoutRequests(providerId: string): Promise<PayoutRequest[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as any as PayoutRequestRow[]) : [];
    return rows.map(rowToPayoutRequest);
  }
  const all = await readAll();
  return all
    .filter((r) => r.providerId === providerId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function listAllPayoutRequests(): Promise<PayoutRequest[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('payout_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as any as PayoutRequestRow[]) : [];
    return rows.map(rowToPayoutRequest);
  }
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
      return st === 'pending' || st === 'approved' || st === 'pending_admin_review' || st === 'processing';
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function updatePayoutRequest(
  id: string,
  patch: Partial<Pick<PayoutRequest, 'status' | 'approvedAt' | 'paidAt' | 'stripeTransferId'>> & {
    updatedAt?: string;
  }
): Promise<PayoutRequest | null> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const updateRow: any = {};
    if (typeof patch.status === 'string') updateRow.status = patch.status;
    if (typeof patch.stripeTransferId === 'string' || patch.stripeTransferId === null) {
      updateRow.stripe_transfer_id = patch.stripeTransferId;
    }
    if (typeof patch.approvedAt === 'string') updateRow.approved_at = patch.approvedAt;
    if (typeof patch.paidAt === 'string') updateRow.paid_at = patch.paidAt;
    // updated_at handled by trigger, but allow explicit override if provided.
    if (typeof patch.updatedAt === 'string') updateRow.updated_at = patch.updatedAt;

    const { data, error } = await supabase
      .from('payout_requests')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPayoutRequest(data as any) : null;
  }

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
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const updateRow: any = {};
    if (typeof args.patch.status === 'string') updateRow.status = args.patch.status;
    if (typeof args.patch.stripeTransferId === 'string' || args.patch.stripeTransferId === null) {
      updateRow.stripe_transfer_id = args.patch.stripeTransferId;
    }
    if (typeof args.patch.approvedAt === 'string') updateRow.approved_at = args.patch.approvedAt;
    if (typeof args.patch.paidAt === 'string') updateRow.paid_at = args.patch.paidAt;
    if (typeof args.patch.updatedAt === 'string') updateRow.updated_at = args.patch.updatedAt;

    const { data: updatedRow, error } = await supabase
      .from('payout_requests')
      .update(updateRow)
      .eq('id', args.id)
      .in('status', args.fromStatuses as any)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (updatedRow) return { payoutRequest: rowToPayoutRequest(updatedRow as any), updated: true };

    const { data: cur, error: curErr } = await supabase.from('payout_requests').select('*').eq('id', args.id).maybeSingle();
    if (curErr) throw curErr;
    return { payoutRequest: cur ? rowToPayoutRequest(cur as any) : null, updated: false };
  }

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
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const updateRow: any = {};
    if (typeof (patch as any).payoutMethod === 'string') updateRow.payout_method = (patch as any).payoutMethod;
    if (typeof (patch as any).payoutDestinationMasked === 'string')
      updateRow.payout_destination_masked = (patch as any).payoutDestinationMasked;
    if (typeof (patch as any).payoutDestination === 'string') updateRow.payout_destination = (patch as any).payoutDestination;
    if (typeof (patch as any).bankName === 'string') updateRow.bank_name = (patch as any).bankName;
    if (typeof (patch as any).bankAccountNumber === 'string') updateRow.bank_account_number = (patch as any).bankAccountNumber;
    if (typeof (patch as any).bankRoutingNumber === 'string') updateRow.bank_routing_number = (patch as any).bankRoutingNumber;
    if (typeof (patch as any).bankCountry === 'string') updateRow.bank_country = (patch as any).bankCountry;
    if (typeof (patch as any).accountHolderName === 'string') updateRow.account_holder_name = (patch as any).accountHolderName;
    if (typeof (patch as any).wiseEmail === 'string') updateRow.wise_email = (patch as any).wiseEmail;
    if (typeof (patch as any).paypalEmail === 'string') updateRow.paypal_email = (patch as any).paypalEmail;
    if (typeof (patch as any).zelleContact === 'string') updateRow.zelle_contact = (patch as any).zelleContact;

    const { data, error } = await supabase
      .from('payout_requests')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPayoutRequest(data as any) : null;
  }

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


