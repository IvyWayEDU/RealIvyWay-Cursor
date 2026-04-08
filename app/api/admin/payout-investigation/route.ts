import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/errorHandler';
import { getUsers } from '@/lib/auth/storage';
import { getProviders } from '@/lib/providers/storage';
import { findProviderIdsByBankAccountLast4 } from '@/lib/payouts/bank-account-storage';
import {
  getPayoutRequestById,
  listProviderPayoutRequests,
  type PayoutRequest,
} from '@/lib/payouts/payout-requests.server';
import { getProviderEarningsSummary } from '@/lib/earnings/summary.server';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeQuery(v: string): string {
  return cleanString(v).toLowerCase();
}

function last4(v: unknown): string | null {
  const s = cleanString(v);
  if (s.length < 4) return null;
  return s.slice(-4);
}

function payoutDateMs(pr: PayoutRequest): number {
  const paidAt = Date.parse(String(pr.paidAt || ''));
  if (Number.isFinite(paidAt)) return paidAt;
  const approvedAt = Date.parse(String(pr.approvedAt || ''));
  if (Number.isFinite(approvedAt)) return approvedAt;
  const createdAt = Date.parse(String(pr.createdAt || ''));
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function isPendingStatus(st: unknown): boolean {
  const s = normalizeQuery(String(st || ''));
  return s === 'pending' || s === 'pending_admin_review';
}

function isApprovedStatus(st: unknown): boolean {
  const s = normalizeQuery(String(st || ''));
  return s === 'approved' || s === 'processing';
}

function isPaidStatus(st: unknown): boolean {
  const s = normalizeQuery(String(st || ''));
  return s === 'paid' || s === 'completed';
}

export async function GET(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const sp = request.nextUrl.searchParams;
    const providerEmail = cleanString(sp.get('providerEmail'));
    const providerName = cleanString(sp.get('providerName'));
    const payoutId = cleanString(sp.get('payoutId'));
    const bankLast4Digits = cleanString(sp.get('bankLast4Digits'));

    if (!providerEmail && !providerName && !payoutId && !bankLast4Digits) {
      return NextResponse.json(
        { error: 'At least one search field is required' },
        { status: 400 }
      );
    }

    const providerIds = new Set<string>();
    let matchedPayoutRequest: PayoutRequest | null = null;

    if (payoutId) {
      const pr = await getPayoutRequestById(payoutId);
      if (pr?.providerId) {
        matchedPayoutRequest = pr;
        providerIds.add(String(pr.providerId));
      }
    }

    const [users, providers] = await Promise.all([
      getUsers(),
      getProviders(),
    ]);

    const providerByUserId = new Map<string, any>((providers || []).map((p: any) => [String(p.userId || ''), p]));

    const emailQ = normalizeQuery(providerEmail);
    const nameQ = normalizeQuery(providerName);

    if (emailQ || nameQ) {
      for (const u of users || []) {
        const id = String((u as any)?.id || '').trim();
        if (!id) continue;

        const userEmail = normalizeQuery((u as any)?.email);
        const userName = normalizeQuery((u as any)?.name);

        const emailMatch = emailQ ? userEmail.includes(emailQ) : true;
        const nameMatch = nameQ ? userName.includes(nameQ) : true;
        if (!emailMatch || !nameMatch) continue;

        // Only include users that have provider context (role OR profile).
        const roles = Array.isArray((u as any)?.roles) ? ((u as any).roles as string[]) : [];
        const hasProviderRole = roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor');
        const hasProviderProfile = providerByUserId.has(id);
        if (!hasProviderRole && !hasProviderProfile) continue;

        providerIds.add(id);
      }
    }

    const bankQ = bankLast4Digits.replace(/\D/g, '').slice(-4);
    if (bankQ) {
      // Match against provider profile bankAccountNumber last4.
      for (const [userId, profile] of providerByUserId.entries()) {
        const l4 = last4((profile as any)?.bankAccountNumber);
        if (l4 && l4 === bankQ) providerIds.add(userId);
      }

      // Match against bank accounts table (Supabase)
      const ids = await findProviderIdsByBankAccountLast4(bankQ);
      for (const id of ids) providerIds.add(id);

      // Match against payout request snapshot account number last4 (admin-only snapshot).
      // Note: we only have an indexed way to do this by scanning payout-requests, so we keep it bounded.
      // If a bank search is used, we scan only until we find enough matches.
      if (providerIds.size < 10) {
        // Reuse listAllPayoutRequests? It's not imported here; instead, do an opportunistic scan by reading provider ids from known matches.
        // If no provider matched yet, scanning all payout requests is still fine for small JSON dev storage.
        const { listAllPayoutRequests } = await import('@/lib/payouts/payout-requests.server');
        const all = await listAllPayoutRequests();
        for (const pr of all) {
          if (providerIds.size >= 10) break;
          const l4 = last4((pr as any)?.bankAccountNumber);
          if (l4 && l4 === bankQ) providerIds.add(String(pr.providerId || '').trim());
        }
      }
    }

    const orderedProviderIds = Array.from(providerIds).filter(Boolean).slice(0, 10);

    const results = await Promise.all(
      orderedProviderIds.map(async (providerId) => {
        const user = (users || []).find((u: any) => String(u?.id || '') === providerId) as any;
        const providerProfile = providerByUserId.get(providerId) as any;

        const payoutRequests = await listProviderPayoutRequests(providerId);
        const summary = await getProviderEarningsSummary(providerId);

        const pending = payoutRequests.filter((r) => isPendingStatus(r.status));
        const approved = payoutRequests.filter((r) => isApprovedStatus(r.status));
        const paid = payoutRequests.filter((r) => isPaidStatus(r.status));

        const pendingCents = pending.reduce((sum, r) => sum + Number(r.amountCents || 0), 0);
        const approvedCents = approved.reduce((sum, r) => sum + Number(r.amountCents || 0), 0);
        const completedCents = paid.reduce((sum, r) => sum + Number(r.amountCents || 0), 0);

        const lastPaid = [...paid].sort((a, b) => payoutDateMs(b) - payoutDateMs(a))[0] || null;

        const nowMs = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const stalePending = pending.filter((r) => nowMs - payoutDateMs(r) >= dayMs);
        const staleApproved = approved.filter((r) => nowMs - payoutDateMs(r) >= dayMs);

        const alerts: Array<{ code: string; message: string; payoutRequestIds?: string[] }> = [];
        if (stalePending.length > 0) {
          alerts.push({
            code: 'payout_requested_not_approved',
            message: `Provider has ${stalePending.length} payout request(s) pending for 24h+ (requested but never approved).`,
            payoutRequestIds: stalePending.map((r) => r.id),
          });
        }
        if (staleApproved.length > 0) {
          alerts.push({
            code: 'payout_approved_not_paid',
            message: `Provider has ${staleApproved.length} payout request(s) approved for 24h+ (approved but not marked paid).`,
            payoutRequestIds: staleApproved.map((r) => r.id),
          });
        }
        if (summary.availableBalanceCents > 0 && paid.length === 0 && payoutRequests.length === 0) {
          alerts.push({
            code: 'balance_never_withdrew',
            message: 'Provider has an available balance but has never withdrawn (no payout requests found).',
          });
        }
        if (summary.availableBalanceCents > 0 && paid.length === 0 && payoutRequests.length > 0) {
          alerts.push({
            code: 'balance_no_completed_withdrawals',
            message: 'Provider has an available balance and has no completed payouts yet.',
          });
        }

        return {
          provider: {
            id: providerId,
            name: cleanString(user?.name) || cleanString(user?.email) || providerId,
            email: cleanString(user?.email),
          },
          providerProfile: providerProfile
            ? {
                payoutMethod: cleanString(providerProfile?.payoutMethod) || undefined,
                bankName: cleanString(providerProfile?.bankName) || undefined,
                bankAccountNumberLast4: last4(providerProfile?.bankAccountNumber),
              }
            : null,
          metrics: {
            totalProviderEarningsCents: summary.totalEarningsCents,
            availableBalanceCents: summary.availableBalanceCents,
            pendingPayoutsCents: pendingCents + approvedCents,
            pendingPayoutsCount: pending.length + approved.length,
            completedPayoutsCents: completedCents,
            completedPayoutsCount: paid.length,
            lastPayoutDate: lastPaid ? (lastPaid.paidAt || lastPaid.createdAt) : null,
            lastPayoutAmountCents: lastPaid ? Number(lastPaid.amountCents || 0) : null,
          },
          alerts,
          payoutRequests: (payoutRequests || []).slice(0, 25).map((r) => ({
            id: r.id,
            providerId: r.providerId,
            amountCents: Number(r.amountCents || 0),
            status: r.status,
            createdAt: r.createdAt,
            approvedAt: r.approvedAt || null,
            paidAt: r.paidAt || null,
            payoutMethod: typeof r.payoutMethod === 'string' ? r.payoutMethod : null,
            payoutDestinationMasked: typeof r.payoutDestinationMasked === 'string' ? r.payoutDestinationMasked : null,
          })),
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        query: { providerEmail, providerName, payoutId, bankLast4Digits },
        matchedPayoutRequest: matchedPayoutRequest
          ? { id: matchedPayoutRequest.id, providerId: matchedPayoutRequest.providerId }
          : null,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/payout-investigation]' });
  }
}

