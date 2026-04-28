import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { createSession } from '@/lib/auth/session';
import { createProvider, getProviderByUserId } from '@/lib/providers/storage';
import { ensureStripeCustomerForUser } from '@/lib/stripe/ensureCustomer.server';
import { handleApiError } from '@/lib/errorHandler';
import { UserRole } from '@/lib/auth/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const role = String((body as any)?.role ?? '').trim();
    if (role !== 'student' && role !== 'provider') {
      return NextResponse.json({ error: 'role must be "student" or "provider"' }, { status: 400 });
    }

    // If already assigned (or admin), no-op and route accordingly.
    if (Array.isArray(session.roles) && session.roles.includes('admin')) {
      return NextResponse.json({ success: true, redirectTo: '/admin' });
    }

    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const nextRoles: UserRole[] = role === 'student' ? ['student'] : ['provider'];
    const updated = await updateUser(session.userId, { roles: nextRoles as any });
    if (!updated) return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });

    // Ensure related records exist (best-effort; keep flow moving).
    if (role === 'student') {
      try {
        await ensureStripeCustomerForUser(session.userId);
      } catch (e) {
        console.warn('[STRIPE] Failed to create customer during role selection (non-blocking):', e);
      }
    }

    if (role === 'provider') {
      const providerProfile = await getProviderByUserId(session.userId);
      if (!providerProfile) {
        const name = String((updated as any)?.name || '').trim();
        const nameParts = name.split(' ').filter(Boolean);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        await createProvider({
          id: session.userId,
          userId: session.userId,
          providerType: 'tutor',
          displayName: name || session.userId,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          bio: undefined,
          profileImageUrl: undefined,
          coverImageUrl: undefined,
          phoneNumber: undefined,
          website: undefined,
          location: undefined,
          timezone: undefined,
          qualifications: [],
          certifications: [],
          yearsOfExperience: undefined,
          subjects: [],
          gradeLevels: [],
          availabilityStatus: 'available',
          workingHours: undefined,
          institutionType: undefined,
          accreditation: undefined,
          studentCapacity: undefined,
          profileComplete: false,
          verified: false,
          active: true,
        });
      }
    }

    // Refresh session cookie immediately so routing/guards work on next page.
    await createSession(session.userId, session.email, session.name, nextRoles);

    const redirectTo = role === 'student' ? '/dashboard/student' : '/onboarding/provider';
    return NextResponse.json({ success: true, redirectTo, roles: nextRoles });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/auth/set-role]' });
  }
}

