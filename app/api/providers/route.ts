import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getUsers } from '@/lib/auth/storage';
import { getProviders, createProvider, getProviderByUserId } from '@/lib/providers/storage';
import { getProviderRating } from '@/lib/providers/rating';
import { getReviewsByProviderId } from '@/lib/reviews/storage.server';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { ProviderProfile } from '@/lib/models/types';
import { handleApiError } from '@/lib/errorHandler';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // Booking-flow provider search (virtual tours / school availability checks)
    const { searchParams } = new URL(request.url);
    const serviceTypeRaw = String(searchParams.get('serviceType') || '').trim().toLowerCase().replace(/-/g, '_');
    const schoolId = String(searchParams.get('schoolId') || '').trim();

    if (serviceTypeRaw || schoolId) {
      const users = await getUsers();
      const isProviderUser = (u: any) =>
        Array.isArray(u?.roles) && (u.roles.includes('provider') || u.roles.includes('counselor'));

      const matchesServiceType = (u: any) => {
        if (!serviceTypeRaw) return true;
        if (serviceTypeRaw === 'virtual_tour' || serviceTypeRaw === 'virtual_tours') {
          const services = Array.isArray(u?.services) ? u.services.map((s: any) => String(s || '').trim().toLowerCase()) : [];
          const offersVirtualTours = u?.offersVirtualTours === true;
          return offersVirtualTours || services.includes('virtual_tour') || services.includes('virtual_tours');
        }
        if (serviceTypeRaw === 'college_counseling' || serviceTypeRaw === 'counseling') {
          // Eligibility: provider offers college counseling (do NOT filter by schoolId here).
          // Providers are eligible based on `services` (legacy flags/roles are intentionally ignored).
          const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');
          const services = Array.isArray(u?.services) ? u.services.map(norm) : [];
          const profileServices = Array.isArray(u?.profile?.services) ? u.profile.services.map(norm) : [];
          return services.includes('college_counseling') || services.includes('counseling') || profileServices.includes('college_counseling') || profileServices.includes('counseling');
        }
        // Future-proof: fallback to services array matching
        const services = Array.isArray(u?.services) ? u.services.map((s: any) => String(s || '').trim().toLowerCase().replace(/-/g, '_')) : [];
        return services.includes(serviceTypeRaw);
      };

      const matchesSchool = (u: any) => {
        if (!schoolId) return true;
        // College counseling: school match is preference-only (ordering + messaging), never a hard filter.
        if (serviceTypeRaw === 'college_counseling' || serviceTypeRaw === 'counseling') return true;
        const primary = String(u?.school_id || u?.schoolId || '').trim();
        if (primary && primary === schoolId) return true;
        const ids = Array.isArray(u?.schoolIds) ? u.schoolIds.map((id: any) => String(id || '').trim()) : [];
        return ids.includes(schoolId);
      };

      const filteredBase = users
        .filter(isProviderUser)
        .filter(matchesServiceType)
        .filter(matchesSchool)
        .filter((u: any) => !!String(u?.id || '').trim());

      const computeProviderSchoolId = (u: any): string => {
        const primary = String(u?.school_id || u?.schoolId || '').trim();
        if (primary) return primary;
        const ids = Array.isArray(u?.schoolIds) ? u.schoolIds.map((id: any) => String(id || '').trim()) : [];
        return String(ids[0] || '').trim();
      };

      const computeProviderSchoolName = (u: any): string | null => {
        const primary = typeof u?.school_name === 'string' && u.school_name.trim() ? u.school_name.trim() : '';
        if (primary) return primary;
        const names = Array.isArray(u?.schoolNames) ? u.schoolNames.map((n: any) => String(n || '').trim()) : [];
        return names[0] || null;
      };

      const computeProviderName = (u: any): string => {
        const p0 =
          typeof u?.profile?.displayName === 'string' && u.profile.displayName.trim()
            ? u.profile.displayName.trim()
            : '';
        if (p0) return p0;
        const p1 = typeof u?.displayName === 'string' && u.displayName.trim() ? u.displayName.trim() : '';
        if (p1) return p1;
        const p2 = typeof u?.name === 'string' && u.name.trim() ? u.name.trim() : '';
        return p2 || 'Provider';
      };

      const filtered =
        serviceTypeRaw === 'college_counseling' || serviceTypeRaw === 'counseling'
          ? filteredBase
              .map((u: any) => {
                const providerSchoolId = computeProviderSchoolId(u);
                return {
                  id: String(u?.id || ''),
                  providerName: computeProviderName(u),
                  providerSchoolName: computeProviderSchoolName(u),
                  matchesRequestedSchool: !!schoolId && !!providerSchoolId && providerSchoolId === schoolId,
                };
              })
              .sort((a: any, b: any) => {
                if (schoolId) {
                  if (a.matchesRequestedSchool !== b.matchesRequestedSchool) return a.matchesRequestedSchool ? -1 : 1;
                }
                return String(a.providerName || '').localeCompare(String(b.providerName || ''));
              })
          : filteredBase.map((u: any) => ({
              id: String(u?.id || ''),
              name: typeof u?.name === 'string' ? u.name : '',
              school_id: typeof u?.school_id === 'string' ? u.school_id : undefined,
              school_name: typeof u?.school_name === 'string' ? u.school_name : undefined,
              schoolIds: Array.isArray(u?.schoolIds) ? u.schoolIds : undefined,
              offersVirtualTours: u?.offersVirtualTours === true,
              services: Array.isArray(u?.services) ? u.services : undefined,
            }));

      // Return raw array for lightweight "count" checks in the booking flow.
      return NextResponse.json(filtered);
    }

    // Admin/provider management list (legacy shape)
    const providers = await getProviders();
    
    // Enrich providers with ratings
    const enrichedProviders = await Promise.all(
      providers.map(async (provider) => {
        const reviews = await getReviewsByProviderId(provider.id);
        const sessions = await getSessionsByProviderId(provider.id);
        const rating = getProviderRating(reviews, sessions);
        
        return {
          ...provider,
          ratingAvg: rating.ratingAvg,
          ratingCount: rating.ratingCount,
        };
      })
    );
    
    return NextResponse.json({ providers: enrichedProviders });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/providers] GET' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // Only providers can create provider profiles
    if (!session.roles.includes('provider') && !session.roles.includes('admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Provider role required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { providerType, displayName, bio, subjects, schools, timezone } = body;
    
    // Validate input
    if (!providerType || !displayName) {
      return NextResponse.json(
        { error: 'Provider type and display name are required' },
        { status: 400 }
      );
    }
    
    if (!['tutor', 'counselor', 'institution'].includes(providerType)) {
      return NextResponse.json(
        { error: 'Invalid provider type' },
        { status: 400 }
      );
    }
    
    // Check if provider profile already exists for this user
    const existing = await getProviderByUserId(session.userId);
    if (existing) {
      return NextResponse.json(
        { error: 'Provider profile already exists for this user' },
        { status: 409 }
      );
    }
    
    // Create provider profile
    const provider = await createProvider({
      id: crypto.randomUUID(),
      userId: session.userId,
      providerType,
      displayName: displayName.trim(),
      bio: bio?.trim(),
      subjects: subjects || [],
      specialties: subjects || [],
      availabilityStatus: 'available',
      profileComplete: false,
      verified: false,
      active: true,
      timezone: timezone || 'America/New_York',
    });
    
    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/providers] POST' });
  }
}
