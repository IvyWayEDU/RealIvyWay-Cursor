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
import { getProviderEarningsBalance } from '@/lib/earnings/balances.server';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';

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

        const [payoutRequests, summary, balance, sessions] = await Promise.all([
          listProviderPayoutRequests(providerId),
          getProviderEarningsSummary(providerId),
          getProviderEarningsBalance(providerId),
          getSessionsByProviderId(providerId),
        ]);

        // Session-based net collection (best-effort): gross - refunds for finalized sessions.
        let grossCollectedCents = 0;
        let refundedCents = 0;
        let providerPayoutDueCents = 0;
        let chargebackCents = 0;
        let chargebackOpenCount = 0;
        for (const s of sessions as any[]) {
          const st = String((s as any)?.status || '');
          const finalized = st === 'completed' || st === 'provider_no_show' || st === 'student_no_show' || st === 'refunded';
          if (!finalized) continue;
          grossCollectedCents += Math.max(0, getSessionGrossCents(s as any));
          refundedCents += Math.max(0, Math.floor(Number((s as any)?.amountRefundedCents || 0)));
          providerPayoutDueCents += Math.max(0, calculateProviderPayoutCentsFromSession(s as any));

          const cbStatus = String((s as any)?.chargebackStatus || '').trim().toLowerCase();
          const cbAmount = Math.max(0, Math.floor(Number((s as any)?.chargebackAmountCents || 0)));
          if (cbStatus) {
            chargebackCents += cbAmount;
            if (cbStatus !== 'won' && cbStatus !== 'lost') chargebackOpenCount += 1;
          }
        }
        const netCollectedCents = Math.max(0, grossCollectedCents - refundedCents);
        const platformFeeCents = netCollectedCents - providerPayoutDueCents;

        // Manual override history (earnings adjustments)
        let adjustments: Array<{
          id: string;
          amountCents: number;
          reason: string | null;
          relatedSessionId: string | null;
          relatedPayoutRequestId: string | null;
          createdByAdmin: string | null;
          createdAt: string | null;
        }> = [];
        try {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from('provider_earnings_adjustments')
            .select('*')
            .eq('provider_id', providerId)
            .order('created_at', { ascending: false })
            .limit(25);
          if (error) throw error;
          const rows = Array.isArray(data) ? (data as any[]) : [];
          adjustments = rows.map((r) => ({
            id: String(r?.id || ''),
            amountCents: Number.isFinite(Number(r?.amount_cents)) ? Math.trunc(Number(r.amount_cents)) : 0,
            reason: typeof r?.reason === 'string' ? r.reason : null,
            relatedSessionId: typeof r?.related_session_id === 'string' ? r.related_session_id : null,
            relatedPayoutRequestId: typeof r?.related_payout_request_id === 'string' ? r.related_payout_request_id : null,
            createdByAdmin: typeof r?.created_by_admin === 'string' ? r.created_by_admin : null,
            createdAt: typeof r?.created_at === 'string' ? r.created_at : null,
          }));
        } catch {
          adjustments = [];
        }

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
            availableBalanceCents: balance.availableCents,
            pendingPayoutsCents: pendingCents + approvedCents,
            pendingPayoutsCount: pending.length + approved.length,
            completedPayoutsCents: completedCents,
            completedPayoutsCount: paid.length,
            lastPayoutDate: lastPaid ? (lastPaid.paidAt || lastPaid.createdAt) : null,
            lastPayoutAmountCents: lastPaid ? Number(lastPaid.amountCents || 0) : null,
            // True balances (DB)
            balanceAvailableCents: balance.availableCents,
            balancePendingCents: balance.pendingCents,
            balanceWithdrawnCents: balance.withdrawnCents,
            // Session-level collection impact
            grossCollectedCents,
            refundedCents,
            netCollectedCents,
            providerPayoutDueCents,
            platformFeeCents,
            chargebackCents,
            chargebackOpenCount,
          },
          alerts,
          manualOverrideHistory: adjustments,
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

