import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { updateUser } from '@/lib/auth/storage';
import { handleApiError } from '@/lib/errorHandler';

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Provider-only: students should never be prompted/dismiss.
    if (!Array.isArray(session.roles) || !session.roles.includes('provider')) {
      return NextResponse.json({ success: true });
    }

    await updateUser(session.userId, { availabilityPromptDismissedAt: new Date().toISOString() } as any);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/onboarding/dismiss-availability-prompt]' });
  }
}

