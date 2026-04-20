import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getProviders, createProvider, getProviderByUserId } from '@/lib/providers/storage';
import { getProviderRating } from '@/lib/providers/rating';
import { getReviewsByProviderId } from '@/lib/reviews/storage.server';
import { getSessionsByProviderId } from '@/lib/sessions/storage';
import { ProviderProfile } from '@/lib/models/types';
import { handleApiError } from '@/lib/errorHandler';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
import { normalizeSchoolName } from '@/lib/availability/normalizeSchoolName';

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
    const schoolName = String(searchParams.get('schoolName') || '').trim();
    const requestedService = serviceTypeRaw;
    let normalizedRequestedService = requestedService;
    if (requestedService === 'virtual_tour') {
      normalizedRequestedService = 'college_counseling';
    }
    const requestedSchool = schoolName;
    const requestedSchoolNorm = normalizeSchoolName(requestedSchool);

    if (serviceTypeRaw || schoolId) {
      const supabase = getSupabaseAdmin();
      const { data: rows, error } = await supabase.from('providers').select('id, data').order('id', { ascending: true });
      if (error) throw error;

      const norm = (x: any) => String(x || '').trim().toLowerCase().replace(/-/g, '_');

      const providers = (rows ?? [])
        .map((r: any) => {
          const id = typeof r?.id === 'string' ? r.id.trim() : '';
          const data = r?.data && typeof r.data === 'object' ? r.data : {};
          if (!id) return null;
          const servicesRaw: unknown = (data as any)?.services;
          const services = Array.isArray(servicesRaw) ? servicesRaw.map(norm).filter(Boolean) : [];

          const school_id =
            typeof (data as any)?.schoolId === 'string'
              ? String((data as any).schoolId).trim()
              : typeof (data as any)?.school_id === 'string'
                ? String((data as any).school_id).trim()
                : '';

          const providerSchoolField =
            typeof (data as any)?.school === 'string'
              ? 'school'
              : typeof (data as any)?.college === 'string'
                ? 'college'
                : typeof (data as any)?.university === 'string'
                  ? 'university'
                  : typeof (data as any)?.school_name === 'string'
                    ? 'school_name'
                    : '';
          const providerSchool =
            typeof (data as any)?.school === 'string'
              ? String((data as any).school)
              : typeof (data as any)?.college === 'string'
                ? String((data as any).college)
                : typeof (data as any)?.university === 'string'
                  ? String((data as any).university)
                  : typeof (data as any)?.school_name === 'string'
                    ? String((data as any).school_name)
                    : '';

          const offersVirtualTours = (data as any)?.offersVirtualTours === true || services.includes('virtual_tour');
          return { id, data, services, school_id: school_id || undefined, providerSchool, providerSchoolField, offersVirtualTours };
        })
        .filter(Boolean) as any[];

      const matchesServiceType = (p: any) => {
        if (!serviceTypeRaw) return true;
        if (serviceTypeRaw === 'virtual_tour' || serviceTypeRaw === 'virtual_tours') {
          // Virtual tours can be offered via virtual_tour OR college_counseling (current internal mapping).
          return (
            p?.offersVirtualTours === true ||
            (Array.isArray(p?.services) &&
              (p.services.includes('virtual_tour') || p.services.includes('college_counseling') || p.services.includes('counseling')))
          );
        }
        if (serviceTypeRaw === 'college_counseling' || serviceTypeRaw === 'counseling') {
          return (
            Array.isArray(p?.services) &&
            (p.services.includes('college_counseling') || p.services.includes('counseling') || p.services.includes('virtual_tour'))
          );
        }
        return Array.isArray(p?.services) && p.services.includes(serviceTypeRaw);
      };

      const matchesSchool = (p: any) => {
        if (!schoolId && !schoolName) return true;
        // College counseling: school match is preference-only (ordering + messaging), never a hard filter.
        if (serviceTypeRaw === 'college_counseling' || serviceTypeRaw === 'counseling') return true;
        if (serviceTypeRaw === 'virtual_tour' || serviceTypeRaw === 'virtual_tours') {
          // Virtual tours: strict normalized school-name equality only.
          const providerSchool = String(p?.providerSchool || '').trim();
          const providerSchoolNorm = normalizeSchoolName(providerSchool);
          const isSchoolMatch =
            requestedSchoolNorm.length > 0 &&
            providerSchoolNorm.length > 0 &&
            requestedSchoolNorm === providerSchoolNorm;

          console.log('[VIRTUAL_TOUR_SCHOOL_DEBUG]', {
            requestedService,
            normalizedRequestedService,
            requestedSchool,
            requestedSchoolNorm,
            providerId: String(p?.id || ''),
            providerSchool,
            providerSchoolNorm,
            isSchoolMatch,
            providerServices: (p as any)?.data?.services || [],
            providerSchoolField: String(p?.providerSchoolField || ''),
          });

          return isSchoolMatch;
        }

        // Legacy strict matching for other services.
        const primaryId = String(p?.school_id || '').trim();
        const primaryName = String(p?.providerSchool || '').trim();
        if (schoolId) return !!primaryId && primaryId === schoolId;
        if (schoolName) return !!primaryName && primaryName.toLowerCase() === schoolName.toLowerCase();
        return true;
      };

      const filteredBase = providers.filter(matchesServiceType).filter(matchesSchool);

      const filtered =
        serviceTypeRaw === 'college_counseling' || serviceTypeRaw === 'counseling'
          ? filteredBase
              .map((p: any) => {
                const providerName =
                  typeof p?.data?.displayName === 'string' && p.data.displayName.trim()
                    ? p.data.displayName.trim()
                    : 'Provider';
                const providerSchoolName =
                  typeof p?.providerSchool === 'string' && p.providerSchool.trim() ? p.providerSchool.trim() : null;
                return {
                  id: String(p?.id || ''),
                  providerName,
                  providerSchoolName,
                  matchesRequestedSchool:
                    requestedSchoolNorm.length > 0 &&
                    normalizeSchoolName(providerSchoolName || '').length > 0 &&
                    normalizeSchoolName(providerSchoolName || '') === requestedSchoolNorm,
                };
              })
              .sort((a: any, b: any) => {
                if (schoolId) {
                  if (a.matchesRequestedSchool !== b.matchesRequestedSchool) return a.matchesRequestedSchool ? -1 : 1;
                }
                return String(a.providerName || '').localeCompare(String(b.providerName || ''));
              })
          : filteredBase.map((p: any) => ({
              id: String(p?.id || ''),
              school_id: p.school_id,
              school_name: typeof p?.providerSchool === 'string' && p.providerSchool.trim() ? p.providerSchool.trim() : undefined,
              offersVirtualTours: p.offersVirtualTours === true,
              services: Array.isArray(p?.services) ? p.services : undefined,
            }));

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
