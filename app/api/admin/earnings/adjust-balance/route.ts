import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/errorHandler';
import { getProviderEarningsBalance, updateProviderEarningsBalance } from '@/lib/earnings/balances.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const providerId = String((body as any)?.providerId ?? '').trim();
    const deltaCents = Number((body as any)?.deltaCents ?? 0);
    const reason = String((body as any)?.reason ?? '').trim();
    if (!providerId) return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    if (!Number.isFinite(deltaCents) || !Number.isInteger(deltaCents)) {
      return NextResponse.json({ error: 'deltaCents must be an integer' }, { status: 400 });
    }

    const nowISO = new Date().toISOString();
    const current = await getProviderEarningsBalance(providerId);
    const nextAvailable = Math.max(0, Math.floor((current.availableCents || 0) + deltaCents));

    const updated = await updateProviderEarningsBalance({
      providerId,
      availableCents: nextAvailable,
      pendingCents: current.pendingCents || 0,
      withdrawnCents: current.withdrawnCents || 0,
    });

    // Best-effort: persist an adjustment history entry when table exists.
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('provider_earnings_adjustments').insert({
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        provider_id: providerId,
        amount_cents: Math.trunc(deltaCents),
        reason: reason || null,
        created_by_admin: authResult.session!.userId,
        created_at: nowISO,
      } as any);
    } catch {
      // ignore (table may not exist yet)
    }

    return NextResponse.json({
      success: true,
      providerId,
      balance: {
        availableCents: updated.availableCents,
        pendingCents: updated.pendingCents,
        withdrawnCents: updated.withdrawnCents,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/earnings/adjust-balance]' });
  }
}


