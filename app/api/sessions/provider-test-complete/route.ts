import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getSessionById } from '@/lib/sessions/storage';
import { markSessionCompletedWithEarnings } from '@/lib/sessions/actions';
import { getProviderByUserId } from '@/lib/providers/storage';
import { appendProviderAuditEntry } from '@/lib/audit/providerAudit.server';
import { handleApiError } from '@/lib/errorHandler';

function isDevOrStaging(): boolean {
  // Dev: local NODE_ENV=development
  if (process.env.NODE_ENV !== 'production') return true;
  // Staging: Vercel preview (common) or explicit APP_ENV=staging
  if (process.env.VERCEL_ENV === 'preview') return true;
  if (process.env.APP_ENV === 'staging') return true;
  if (process.env.NEXT_PUBLIC_APP_ENV === 'staging') return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.roles.includes('provider')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = String((body as any)?.sessionId || '').trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (existing.status === 'cancelled') {
      return NextResponse.json({ error: 'Session cannot be completed' }, { status: 400 });
    }

    // Provider can only override their own sessions.
    if (existing.providerId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const providerProfile = await getProviderByUserId(session.userId);
    const isTestAccount =
      Boolean((providerProfile as any)?.is_test_account) || Boolean((providerProfile as any)?.isTestAccount);

    if (!(isDevOrStaging() || isTestAccount)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nowISO = new Date().toISOString();

    // Force completion by calling the same canonical completion handler used elsewhere.
    // This must NOT modify the normal time-based resolver/scheduler behavior.
    await markSessionCompletedWithEarnings(sessionId, 'provider_test_override', {
      completedAt: nowISO,
      actualStartTime: (existing as any)?.actualStartTime || (existing as any)?.providerJoinedAt || undefined,
      actualEndTime: nowISO,
      completionReason: 'PROVIDER_TEST_OVERRIDE',
      creditEarnings: true,
      completedByTestOverride: true,
    });

    await appendProviderAuditEntry({
      providerId: session.userId,
      sessionId,
      timestamp: nowISO,
      source: 'provider_test_override',
    });

    const updated = await getSessionById(sessionId);
    return NextResponse.json({ session: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/provider-test-complete]' });
  }
}


