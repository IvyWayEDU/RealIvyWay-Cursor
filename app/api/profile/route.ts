import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getUserById, updateUser } from '@/lib/auth/storage';
import { normalizeSchoolId } from '@/lib/models/schools';
import { handleApiError } from '@/lib/errorHandler';
import { validateRequestBody } from '@/lib/validation/utils';
import { profileUpdateSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validationResult = await validateRequestBody(request, profileUpdateSchema);
    if (!validationResult.success) return validationResult.response;
    const body = validationResult.data;
    
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

    // Update roles/services
    if (body.isTutor !== undefined || body.isCounselor !== undefined) {
      if (!isProviderOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Provider role required' },
          { status: 403 }
        );
      }
      updateData.isTutor = body.isTutor ?? false;
      updateData.isCounselor = body.isCounselor ?? false;
      
      // Update services array
      const services: string[] = [];
      if (updateData.isTutor) services.push('tutoring');
      if (updateData.isCounselor) services.push('college_counseling');
      updateData.services = services;
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

