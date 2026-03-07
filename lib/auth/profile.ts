'use server';

import { getSession } from './session';
import { getUserById, updateUser } from './storage';
import { User } from './types';
import type { ProviderAvailability } from '@/lib/availability/types';
import { SCHOOLS, findSchoolByName } from '@/data/schools';
import { normalizeSubjectId } from '@/lib/models/subjects';

export interface ProfileData {
  // Basic Information
  name: string;
  email: string;
  profilePhotoUrl?: string;
  profilePhotoSkipped?: boolean;
  phoneNumber?: string;
  
  // Provider Role & Services
  isTutor?: boolean;
  isCounselor?: boolean;
  
  // School Information
  schools?: string[]; // Legacy: kept for backward compatibility
  schoolIds?: string[]; // Normalized school IDs (new format)
  schoolNames?: string[]; // Display names for schools (new format, parallel array to schoolIds)
  
  // Subjects
  subjects?: string[];
  
  // Availability
  availability?: ProviderAvailability;
  
  // Read-only
  onboardingCompleted?: boolean;
}

/**
 * Get current user's profile data
 */
export async function getCurrentUserProfile(): Promise<{
  success: boolean;
  profile?: ProfileData;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Migrate legacy school names to schoolIds if needed
    let schoolIds = user.schoolIds || [];
    let schoolNames = user.schoolNames || [];
    
    // If user has legacy schools but no schoolIds, attempt migration
    if (user.schools && user.schools.length > 0 && schoolIds.length === 0) {
      const convertedSchools = user.schools
        .map(legacyName => {
          const school = findSchoolByName(legacyName);
          if (school) return { id: school.id, name: school.name };

          // Best-effort snake_case normalization for legacy strings
          const normalized = String(legacyName || '')
            .trim()
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

          const byId = SCHOOLS.find((s) => s.id === normalized);
          if (byId) return { id: byId.id, name: byId.name };

          // Accept hyphen-case legacy ids
          const hyphenAsSnake = normalized.replace(/-/g, '_');
          const byHyphen = SCHOOLS.find((s) => s.id === hyphenAsSnake);
          if (byHyphen) return { id: byHyphen.id, name: byHyphen.name };

          return null;
        })
        .filter((s): s is { id: string; name: string } => s !== null);
      
      if (convertedSchools.length > 0) {
        schoolIds = convertedSchools.map(s => s.id);
        schoolNames = convertedSchools.map(s => s.name);
        
        // Auto-save the migration
        await updateUser(session.userId, {
          schoolIds,
          schoolNames,
          school_id: schoolIds[0],
          school_name: schoolNames[0],
        });
      }
    }

    const profile: ProfileData = {
      name: user.name,
      email: user.email,
      profilePhotoUrl: user.profilePhotoUrl ?? undefined,
      profilePhotoSkipped: user.profilePhotoSkipped,
      phoneNumber: (user as any).phoneNumber, // May not be in type yet
      isTutor: user.isTutor ?? user.roles.includes('tutor'),
      isCounselor: user.isCounselor ?? user.roles.includes('counselor'),
      schools: user.schools || [], // Legacy
      schoolIds,
      schoolNames,
      subjects: user.subjects || [],
      onboardingCompleted: user.onboardingCompleted,
    };

    return { success: true, profile };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return { success: false, error: 'Failed to get user profile' };
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  updates: Partial<ProfileData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Validate conditional requirements
    const isTutor = updates.isTutor ?? user.isTutor ?? user.roles.includes('tutor');
    const isCounselor = updates.isCounselor ?? user.isCounselor ?? user.roles.includes('counselor');

    // Validate schoolIds for counselors (new format)
    if (isCounselor) {
      const schoolIds = updates.schoolIds ?? user.schoolIds ?? [];
      if (schoolIds.length === 0) {
        return { success: false, error: 'At least one school is required for counselors. Please select a school from the dropdown.' };
      }
    }

    if (isTutor) {
      const finalSubjects = updates.subjects ?? user.subjects ?? [];
      if (finalSubjects.length === 0) {
        return { success: false, error: 'Subjects are required for tutors' };
      }
    }

    // Prepare user updates (exclude availability as it's stored separately)
    const { availability: _availability, ...userUpdates } = updates;

    // Normalize schoolIds if provided to ensure consistent matching
    if (userUpdates.schoolIds && Array.isArray(userUpdates.schoolIds)) {
      userUpdates.schoolIds = userUpdates.schoolIds.map(id => {
        const raw = String(id || '').trim();
        if (!raw) return raw;
        // Canonical IDs are snake_case from `data/schools.ts`
        if (SCHOOLS.find((s) => s.id === raw)) return raw;
        const hyphenAsSnake = raw.replace(/-/g, '_');
        if (SCHOOLS.find((s) => s.id === hyphenAsSnake)) return hyphenAsSnake;
        // Best-effort: keep underscores and normalize whitespace/punctuation
        return raw
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
      });
    }

    // Keep single-source-of-truth provider school fields in sync (primary school = first id/name).
    if (Array.isArray(userUpdates.schoolIds) && userUpdates.schoolIds.length > 0) {
      (userUpdates as any).school_id = String(userUpdates.schoolIds[0] || '').trim() || undefined;
    }
    if (Array.isArray(userUpdates.schoolNames) && userUpdates.schoolNames.length > 0) {
      (userUpdates as any).school_name = String(userUpdates.schoolNames[0] || '').trim() || undefined;
    }

    // Step 4: Normalize subjects before saving to database
    // Map every incoming subject through normalizeSubjectId to store only canonical subject ids
    if (userUpdates.subjects && Array.isArray(userUpdates.subjects)) {
      userUpdates.subjects = userUpdates.subjects
        .map((subject: string) => normalizeSubjectId(subject))
        .filter((subject: string | null): subject is string => subject !== null);
    }

    // Update user
    await updateUser(session.userId, userUpdates as Partial<User>);

    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

