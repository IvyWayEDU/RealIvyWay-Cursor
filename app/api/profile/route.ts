import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { normalizeSchoolId } from '@/lib/models/schools';
import { getProviderByUserId, upsertProviderDataByUserId } from '@/lib/providers/storage';
import { handleApiError } from '@/lib/errorHandler';
import { profileUpdateSchema } from '@/lib/validation/schemas';
import { SCHOOLS, findSchoolByName } from '@/data/schools';
import { normalizeSubjectId } from '@/lib/models/subjects';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let rawBody: any;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    console.log("Incoming profile data:", rawBody);

    const parsed = profileUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return NextResponse.json({ error: 'Validation failed', details }, { status: 400 });
    }
    const body = parsed.data;
    
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
    if (body.schoolId !== undefined || body.schoolName !== undefined || body.school !== undefined) {
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
        typeof body.school === 'string' && body.school.trim()
          ? body.school.trim()
          : typeof body.schoolName === 'string' && body.schoolName.trim()
            ? body.schoolName.trim()
            : existingPrimarySchoolName;

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
      if (typeof body.school !== 'undefined' || typeof body.schoolName !== 'undefined') {
        updateData.school_name = nextPrimarySchoolName || undefined;
      }
    }

    // Update roles/services (provider-only)
    if (body.services !== undefined || body.offersVirtualTours !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json({ error: 'Forbidden: Provider role required' }, { status: 403 });
      }

      const existingServicesRaw: unknown = (user as any)?.services ?? (user as any)?.profile?.services ?? [];
      const existingServices = Array.isArray(existingServicesRaw)
        ? existingServicesRaw.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean)
        : [];

      // `services` is the source of truth (already normalized by schema). If absent, start from existing.
      let nextServices: string[] = Array.isArray(body.services) ? [...body.services] : [...existingServices];

      // If offersVirtualTours is explicitly toggled without a services payload, keep services in sync.
      if (!Array.isArray(body.services) && typeof body.offersVirtualTours === 'boolean') {
        if (body.offersVirtualTours && !nextServices.includes('virtual_tour')) nextServices.push('virtual_tour');
        if (!body.offersVirtualTours) nextServices = nextServices.filter((s) => s !== 'virtual_tour');
      }

      // De-dupe while preserving order.
      nextServices = Array.from(new Set(nextServices));

      updateData.services = nextServices;
      // Keep offersVirtualTours derived from services for consistency.
      updateData.offersVirtualTours = nextServices.includes('virtual_tour');
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
      const canonicalSubjects = Array.isArray(body.subjects)
        ? Array.from(
            new Set(
              body.subjects
                .map((s) => normalizeSubjectId(typeof s === 'string' ? s : String(s ?? '')))
                .filter((s): s is string => !!s)
            )
          )
        : [];
      updateData.subjects = canonicalSubjects;
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

      // Consistency rule: Test Prep is NOT a service.
      // Preserve backward compatibility by mapping any legacy value to tutoring.
      const servicesCanonical = Array.from(
        new Set(
          services
            .map((s) => String(s ?? '').trim().toLowerCase().replace(/-/g, '_'))
            .map((s) => (s === 'test_prep' || s === 'testprep' ? 'tutoring' : s))
            .filter(Boolean)
        )
      );

      const hasCounseling = servicesCanonical.includes('college_counseling');
      const hasVirtualTours = servicesCanonical.includes('virtual_tour');

      // School is required for counseling OR virtual tours.
      const nextSchoolId: string | null =
        (typeof updateData.school_id === 'string' && updateData.school_id.trim() ? updateData.school_id.trim() : null) ??
        (typeof (updateData as any).schoolId === 'string' && (updateData as any).schoolId.trim() ? (updateData as any).schoolId.trim() : null) ??
        (Array.isArray(updateData.schoolIds) && updateData.schoolIds.length > 0 ? String(updateData.schoolIds[0] || '').trim() : null) ??
        (typeof (user as any)?.school_id === 'string' && (user as any).school_id.trim() ? (user as any).school_id.trim() : null) ??
        (Array.isArray((user as any)?.schoolIds) && (user as any).schoolIds.length > 0 ? String((user as any).schoolIds[0] || '').trim() : null);

      const nextSchoolName: string | null =
        (typeof updateData.school_name === 'string' && updateData.school_name.trim() ? updateData.school_name.trim() : null) ??
        (typeof (updateData as any).schoolName === 'string' && (updateData as any).schoolName.trim() ? (updateData as any).schoolName.trim() : null) ??
        (typeof (updateData as any).school === 'string' && (updateData as any).school.trim() ? (updateData as any).school.trim() : null) ??
        (Array.isArray(updateData.schoolNames) && updateData.schoolNames.length > 0 ? String(updateData.schoolNames[0] || '').trim() : null) ??
        (typeof (user as any)?.school_name === 'string' && (user as any).school_name.trim() ? (user as any).school_name.trim() : null) ??
        (Array.isArray((user as any)?.schoolNames) && (user as any).schoolNames.length > 0 ? String((user as any).schoolNames[0] || '').trim() : null);

      if ((hasCounseling || hasVirtualTours) && (!nextSchoolId || !nextSchoolName)) {
        return NextResponse.json(
          { error: 'school and schoolId are required when services includes college_counseling or virtual_tour.' },
          { status: 400 }
        );
      }

      // Keep offersVirtualTours derived from services.
      updateData.services = servicesCanonical;
      updateData.offersVirtualTours = servicesCanonical.includes('virtual_tour');

      // Persist canonical provider payload to providers.data as well.
      const existingProvider = await getProviderByUserId(session.userId).catch(() => null);
      const existingAvailability = Array.isArray((existingProvider as any)?.availability) ? (existingProvider as any).availability : [];
      const nextAvailability = Object.prototype.hasOwnProperty.call(rawBody, 'availability')
        ? (Array.isArray(body.availability) ? body.availability : [])
        : existingAvailability;

      const providerSubjects = Array.isArray(updateData.subjects) ? updateData.subjects : Array.isArray((user as any)?.subjects) ? (user as any).subjects : [];

      const providerData = {
        services: servicesCanonical,
        school: nextSchoolName ?? null,
        schoolId: nextSchoolId ?? null,
        availability: nextAvailability,
        offersVirtualTours: servicesCanonical.includes('virtual_tour'),
        // Provider-level subjects used for availability filtering (canonical keys only).
        subjects: providerSubjects,
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

