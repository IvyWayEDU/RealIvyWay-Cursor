import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { createProvider, getProviderByUserId } from '@/lib/providers/storage';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const userId = String((body as any)?.userId ?? '').trim();
    const role = String((body as any)?.role ?? '').trim();
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (role !== 'student' && role !== 'provider') {
      return NextResponse.json({ error: 'role must be "student" or "provider"' }, { status: 400 });
    }

    const existing = await getUserById(userId);
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (Array.isArray((existing as any).roles) && (existing as any).roles.includes('admin')) {
      return NextResponse.json({ error: 'Cannot change role for admin user' }, { status: 400 });
    }

    const nextRoles = [role];
    const user = await updateUser(userId, { roles: nextRoles as any });
    if (!user) return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });

    // Best-effort: ensure provider profile exists when switching to provider.
    if (role === 'provider') {
      const providerProfile = await getProviderByUserId(userId);
      if (!providerProfile) {
        const name = String((existing as any)?.name || '').trim();
        const nameParts = name.split(' ').filter(Boolean);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        await createProvider({
          id: userId,
          userId,
          providerType: 'tutor',
          displayName: name || userId,
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
          specialties: [],
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

    return NextResponse.json({ success: true, user });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/users/change-role]' });
  }
}


