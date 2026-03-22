import { NextResponse } from 'next/server';
import { getSessions, saveSessions } from '@/lib/sessions/storage';
import { getUsers } from '@/lib/auth/storage';
import { handleApiError } from '@/lib/errorHandler';
import { getServerSession } from '@/lib/auth/getServerSession';

function countJoins(session: any): { providerJoinCount: number; studentJoinCount: number } {
  const providerJoinedAt = session?.providerJoinedAt ? new Date(session.providerJoinedAt).getTime() : NaN;
  const studentJoinedAt = session?.studentJoinedAt ? new Date(session.studentJoinedAt).getTime() : NaN;

  const logs: any[] = Array.isArray(session?.zoomJoinLogs) ? session.zoomJoinLogs : [];
  const providerJoinCountFromLogs = logs.filter((l) => String(l?.role || '').toLowerCase() === 'provider').length;
  const studentJoinCountFromLogs = logs.filter((l) => String(l?.role || '').toLowerCase() === 'student').length;

  const providerJoinCount = providerJoinCountFromLogs > 0 ? providerJoinCountFromLogs : Number.isFinite(providerJoinedAt) ? 1 : 0;
  const studentJoinCount = studentJoinCountFromLogs > 0 ? studentJoinCountFromLogs : Number.isFinite(studentJoinedAt) ? 1 : 0;

  return { providerJoinCount, studentJoinCount };
}

/**
 * DEV-ONLY: Backfill provider earnings eligibility flags on completed sessions.
 *
 * Why: Available Balance is derived from completed sessions, but older/dev sessions were being
 * auto-marked as "no-show / ineligible" when Zoom join evidence was missing. That caused
 * `/api/provider/earnings/summary` to return 0 balances while the UI's client-side fallback still
 * showed correct Total Earnings.
 *
 * What it does:
 * - For completed sessions, if the only reason earnings are withheld is "no join evidence",
 *   flip providerEarned/providerEligibleForPayout back to true (and clear no-show flags).
 * - If we have positive evidence the student joined but the provider did not, we keep it withheld.
 */
export async function POST() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 });
    }

    // SECURITY: admin-only even in development
    const session = await getServerSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'admin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const [users, sessions] = await Promise.all([getUsers(), getSessions()]);
    const providerIds = new Set(
      (users || [])
        .filter((u: any) => Array.isArray(u?.roles) && u.roles.includes('provider'))
        .map((u: any) => String(u.id))
    );

    let scanned = 0;
    let updated = 0;
    const updatedSessionIds: string[] = [];

    const next = sessions.map((s: any) => {
      scanned += 1;
      if (s?.status !== 'completed') return s;
      if (!providerIds.has(String(s?.providerId || ''))) return s;

      const earned = typeof s?.providerEarned === 'boolean' ? s.providerEarned : null;
      const eligible = typeof s?.providerEligibleForPayout === 'boolean' ? s.providerEligibleForPayout : null;

      // Only consider sessions currently withheld.
      if (earned !== false && eligible !== false) return s;

      // If we have evidence the student joined but provider didn't, keep withheld.
      const { providerJoinCount, studentJoinCount } = countJoins(s);
      if (studentJoinCount > 0 && providerJoinCount === 0) return s;

      updated += 1;
      updatedSessionIds.push(String(s?.id || ''));

      return {
        ...s,
        providerEarned: true,
        providerEligibleForPayout: true,
        flagNoShowProvider: false,
        attendanceFlag: 'none',
        noShowParty: null,
        flaggedAt: null,
        flaggedReason: null,
        attendanceCheckedAt: new Date().toISOString(),
        attendanceSource: 'dev_rebuild_provider_balances',
        updatedAt: new Date().toISOString(),
      };
    });

    await saveSessions(next as any);

    return NextResponse.json({
      success: true,
      scanned,
      updated,
      updatedSessionIds: updatedSessionIds.slice(0, 50),
      updatedSessionIdsTruncated: updatedSessionIds.length > 50,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/dev/rebuild-provider-balances]' });
  }
}


