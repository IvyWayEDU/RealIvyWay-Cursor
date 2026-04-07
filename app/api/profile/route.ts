import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { normalizeSchoolId } from '@/lib/models/schools';
import { upsertProviderDataByUserId } from '@/lib/providers/storage';
import { handleApiError } from '@/lib/errorHandler';
import { validateRequestBody } from '@/lib/validation/utils';
import { profileUpdateSchema } from '@/lib/validation/schemas';
import { SCHOOLS, findSchoolByName } from '@/data/schools';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validationResult = await validateRequestBody(request, profileUpdateSchema);
    if (!validationResult.success) return validationResult.response;
    const body = validationResult.data;

    console.log('PROFILE UPDATE PAYLOAD:', body);
    
    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isProviderOrAdmin = session.roles.includes('provider') || session.roles.includes('admin');

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.profilePhotoUrl !== undefined) {
      updateData.profilePhotoUrl = body.profilePhotoUrl;
    }

    // Update primary school (single-field partial update).
    // Supports clients that send `schoolId` / `schoolName` instead of `schoolIds` / `schoolNames`.
    if (body.schoolId !== undefined || body.schoolName !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json({ error: 'Forbidden: Provider role required' }, { status: 403 });
      }

      const existingPrimarySchoolId: string | undefined =
        (user as any)?.school_id ?? (Array.isArray((user as any)?.schoolIds) ? (user as any).schoolIds[0] : undefined);
      const existingPrimarySchoolName: string | undefined =
        (user as any)?.school_name ??
        (Array.isArray((user as any)?.schoolNames) ? (user as any).schoolNames[0] : undefined);

      let nextPrimarySchoolId =
        typeof body.schoolId === 'string' && body.schoolId.trim() ? body.schoolId.trim() : existingPrimarySchoolId;
      let nextPrimarySchoolName =
        typeof body.schoolName === 'string' && body.schoolName.trim() ? body.schoolName.trim() : existingPrimarySchoolName;

      if (typeof nextPrimarySchoolId === 'string' && nextPrimarySchoolId) {
        // Prefer canonical snake_case IDs from `data/schools.ts`.
        const direct = SCHOOLS.find((s) => s.id === nextPrimarySchoolId);
        const hyphenAsSnake = nextPrimarySchoolId.replace(/-/g, '_');
        const byHyphen = SCHOOLS.find((s) => s.id === hyphenAsSnake);
        const byName = !direct && !byHyphen ? findSchoolByName(nextPrimarySchoolId) : undefined;

        if (direct) {
          if (!nextPrimarySchoolName) nextPrimarySchoolName = direct.name;
        } else if (byHyphen) {
          nextPrimarySchoolId = byHyphen.id;
          if (!nextPrimarySchoolName) nextPrimarySchoolName = byHyphen.name;
        } else if (byName) {
          nextPrimarySchoolId = byName.id;
          if (!nextPrimarySchoolName) nextPrimarySchoolName = byName.name;
        } else {
          // Best-effort normalization (snake_case)
          nextPrimarySchoolId = nextPrimarySchoolId
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        }
      }

      if (typeof body.schoolId !== 'undefined') updateData.school_id = nextPrimarySchoolId || undefined;
      if (typeof body.schoolName !== 'undefined') updateData.school_name = nextPrimarySchoolName || undefined;
    }

    // Update roles/services (provider-only)
    if (body.isTutor !== undefined || body.isCounselor !== undefined || body.services !== undefined || body.offersVirtualTours !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json({ error: 'Forbidden: Provider role required' }, { status: 403 });
      }

      const existingServicesRaw: unknown = (user as any)?.services ?? (user as any)?.profile?.services ?? [];
      const existingServices = Array.isArray(existingServicesRaw)
        ? existingServicesRaw.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean)
        : [];
      const existingServiceSet = new Set(existingServices);
      const existingIsTutor = Boolean((user as any)?.isTutor ?? existingServiceSet.has('tutoring'));
      const existingIsCounselor = Boolean((user as any)?.isCounselor ?? existingServiceSet.has('college_counseling'));
      const existingOffersVirtualTours = Boolean((user as any)?.offersVirtualTours ?? false);

      const nextOffersVirtualTours =
        typeof body.offersVirtualTours === 'boolean' ? body.offersVirtualTours : existingOffersVirtualTours;

      // If `services` is explicitly provided, treat it as source of truth (already normalized by schema).
      let nextServices: string[] | null = Array.isArray(body.services) ? [...body.services] : null;

      if (!nextServices) {
        // Otherwise, derive services from role flags while preserving unspecified flags.
        const nextIsTutor = typeof body.isTutor === 'boolean' ? body.isTutor : existingIsTutor;
        const nextIsCounselor = typeof body.isCounselor === 'boolean' ? body.isCounselor : existingIsCounselor;

        nextServices = [];
        if (nextIsTutor) nextServices.push('tutoring');
        if (nextIsCounselor) nextServices.push('college_counseling');
        if (nextOffersVirtualTours) nextServices.push('virtual_tour');
      } else {
        // Keep offersVirtualTours in sync with services when it's explicitly enabled.
        if (nextOffersVirtualTours && !nextServices.includes('virtual_tour')) nextServices.push('virtual_tour');
      }

      // De-dupe while preserving order.
      nextServices = Array.from(new Set(nextServices));

      updateData.services = nextServices;

      // Keep legacy flags consistent (used by UI as a fallback).
      updateData.isTutor = nextServices.includes('tutoring') || nextServices.includes('test_prep');
      updateData.isCounselor = nextServices.includes('college_counseling');
    }

    // Update schools
    if (body.schoolIds !== undefined && body.schoolNames !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Provider role required' },
          { status: 403 }
        );
      }
      // Normalize school IDs
      const normalizedSchoolIds = Array.isArray(body.schoolIds)
        ? (body.schoolIds as string[]).map((id) => normalizeSchoolId(id))
        : [];
      updateData.schoolIds = normalizedSchoolIds;
      updateData.schoolNames = body.schoolNames;
      // Single source of truth for matching + display (primary school = first selection)
      updateData.school_id = normalizedSchoolIds.length > 0 ? normalizedSchoolIds[0] : undefined;
      updateData.school_name = Array.isArray(body.schoolNames) && body.schoolNames.length > 0 ? body.schoolNames[0] : undefined;
    }

    // Update subjects
    if (body.subjects !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Provider role required' },
          { status: 403 }
        );
      }
      updateData.subjects = body.subjects;
    }

    // Update virtual tours
    if (body.offersVirtualTours !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Provider role required' },
          { status: 403 }
        );
      }
      updateData.offersVirtualTours = body.offersVirtualTours;
    }

    // Update email (only if provided and different)
    if (body.email !== undefined && body.email !== user.email) {
      // Email changes require verification - this should be handled via /api/profile/verify
      // For now, we'll allow it but in production this should check verification status
      updateData.email = body.email;
    }

    // Update phone number (only if provided and different)
    if (body.phoneNumber !== undefined) {
      updateData.phoneNumber = body.phoneNumber;
    }

    // Enforce provider rules (server-side source-of-truth)
    if (isProviderOrAdmin) {
      const services: string[] = Array.isArray(updateData.services)
        ? updateData.services.map((s: any) => String(s ?? '').trim()).filter(Boolean)
        : Array.isArray((user as any)?.services)
          ? (user as any).services.map((s: any) => String(s ?? '').trim()).filter(Boolean)
          : [];

      const hasCounseling = services.includes('college_counseling');
      const hasVirtualTours = services.includes('virtual_tour');

      // School is required for counseling + virtual tours.
      const nextSchoolId: string | null =
        (typeof updateData.school_id === 'string' && updateData.school_id.trim() ? updateData.school_id.trim() : null) ??
        (Array.isArray(updateData.schoolIds) && updateData.schoolIds.length > 0 ? String(updateData.schoolIds[0] || '').trim() : null) ??
        (typeof (user as any)?.school_id === 'string' && (user as any).school_id.trim() ? (user as any).school_id.trim() : null) ??
        (Array.isArray((user as any)?.schoolIds) && (user as any).schoolIds.length > 0 ? String((user as any).schoolIds[0] || '').trim() : null);

      const nextSchoolName: string | null =
        (typeof updateData.school_name === 'string' && updateData.school_name.trim() ? updateData.school_name.trim() : null) ??
        (Array.isArray(updateData.schoolNames) && updateData.schoolNames.length > 0 ? String(updateData.schoolNames[0] || '').trim() : null) ??
        (typeof (user as any)?.school_name === 'string' && (user as any).school_name.trim() ? (user as any).school_name.trim() : null) ??
        (Array.isArray((user as any)?.schoolNames) && (user as any).schoolNames.length > 0 ? String((user as any).schoolNames[0] || '').trim() : null);

      if ((hasCounseling || hasVirtualTours) && (!nextSchoolId || !nextSchoolName)) {
        return NextResponse.json(
          { error: 'School is required for college counseling and virtual tours.' },
          { status: 400 }
        );
      }

      // Keep offersVirtualTours derived from services when services are present.
      if (Array.isArray(updateData.services)) {
        updateData.offersVirtualTours = services.includes('virtual_tour');
      }

      // Persist canonical provider payload to providers.data as well.
      const providerData = {
        services,
        school: nextSchoolName ?? null,
        schoolId: nextSchoolId ?? null,
        isTutor: services.includes('tutoring') || services.includes('test_prep'),
        isCounselor: services.includes('college_counseling'),
        offersVirtualTours: services.includes('virtual_tour'),
      };

      await upsertProviderDataByUserId(session.userId, providerData as any);
      console.log('Provider saved:', providerData);
    }

    // Update user
    const updatedUser = await updateUser(session.userId, updateData);
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/profile]' });
  }
}

