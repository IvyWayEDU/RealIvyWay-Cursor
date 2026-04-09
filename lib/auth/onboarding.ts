'use server';

import { getSession } from './session';
import { getUserById, updateUser } from './storage';
import { User } from './types';
import { SCHOOLS, findSchoolByName } from '@/data/schools';
import { normalizeSubjectId } from '@/lib/models/subjects';
import { normalizeSchoolName } from '@/lib/models/normalizeSchoolName';

export interface OnboardingData {
  profilePhotoUrl?: string;
  profilePhotoSkipped?: boolean;
  /**
   * Newer provider onboarding flow uses this key (matches user record field used across the app).
   * Keep optional for backwards compatibility with legacy `profilePhotoUrl`.
   */
  profileImageUrl?: string | null;
  isTutor?: boolean; // Legacy: kept for backward compatibility
  isCounselor?: boolean; // Legacy: kept for backward compatibility
  services?: string[]; // New: ['tutoring', 'college_counseling']
  schools?: string[]; // Legacy: kept for backward compatibility
  schoolIds?: string[]; // Normalized school IDs (new format)
  schoolNames?: string[]; // Display names for schools (new format, parallel array to schoolIds)
  school?: string; // Legacy: plain string for college counseling school
  schoolId?: string | null; // New: single school ID for college counseling
  schoolName?: string | null; // New: single school name for college counseling
  subjects?: string[];
  offersVirtualTours?: boolean | null; // New: virtual tours eligibility
}

/**
 * Get current user's onboarding status
 */
export async function getOnboardingStatus(): Promise<{
  completed: boolean;
  user: User | null;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { completed: false, user: null, error: 'Not authenticated' };
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return { completed: false, user: null, error: 'User not found' };
    }

    return {
      completed: user.onboardingCompleted === true,
      user,
    };
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    return { completed: false, user: null, error: 'Failed to get onboarding status' };
  }
}

/**
 * Save onboarding progress (partial updates)
 */
export async function saveOnboardingProgress(
  data: Partial<OnboardingData>
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

    // Check if user is a provider
    const isProvider = user.roles.includes('provider') || user.roles.includes('tutor') || user.roles.includes('counselor');
    if (!isProvider) {
      return { success: false, error: 'User is not a provider' };
    }

    // Normalize schoolIds if provided to ensure consistent matching
    const normalizedData = { ...data };
    
    const hasExplicitSchoolUpdate =
      Object.prototype.hasOwnProperty.call(normalizedData, 'schoolId') ||
      Object.prototype.hasOwnProperty.call(normalizedData, 'schoolName') ||
      Object.prototype.hasOwnProperty.call(normalizedData, 'school');

    const rawSchoolName =
      typeof (normalizedData as any).schoolName === 'string'
        ? String((normalizedData as any).schoolName).trim()
        : typeof (normalizedData as any).school === 'string'
          ? String((normalizedData as any).school).trim()
          : '';
    const rawSchoolId =
      typeof (normalizedData as any).schoolId === 'string' ? String((normalizedData as any).schoolId).trim() : '';

    // If school was explicitly cleared/skipped, clear all related fields so merged updates don't keep stale values.
    if (hasExplicitSchoolUpdate && !rawSchoolName && !rawSchoolId) {
      (normalizedData as any).schoolId = null;
      (normalizedData as any).schoolName = null;
      (normalizedData as any).schoolIds = [];
      (normalizedData as any).schoolNames = [];
      (normalizedData as any).school_id = null;
      (normalizedData as any).school_name = null;
      (normalizedData as any).school = null;
      (normalizedData as any).school_raw = null;
      (normalizedData as any).school_normalized = null;
    }

    // If the user typed a free-text school (no canonical ID), accept it and normalize the display name.
    // If the user selected from the dropdown (has a canonical ID), keep the provided casing as-is.
    // We persist free-text to legacy `school` so completion logic can derive schoolIds/school_name consistently.
    if (rawSchoolName) {
      const incomingSchoolId =
        rawSchoolId;

      if (!incomingSchoolId) {
        const normalizedName = normalizeSchoolName(rawSchoolName);
        (normalizedData as any).school_raw = rawSchoolName;
        (normalizedData as any).school_normalized = normalizedName;

        (normalizedData as any).schoolId = null;
        (normalizedData as any).schoolName = normalizedName;
        (normalizedData as any).school = normalizedName;

        // Clear any prior canonical arrays/fields so we don't keep stale IDs.
        (normalizedData as any).schoolIds = [];
        (normalizedData as any).schoolNames = [];
        (normalizedData as any).school_id = null;
        (normalizedData as any).school_name = null;
      } else {
        (normalizedData as any).schoolId = incomingSchoolId;
        (normalizedData as any).school_raw = rawSchoolName;
        (normalizedData as any).school_normalized = rawSchoolName;
      }
    }

    // Handle single schoolId/schoolName (from ProviderOnboardingClient)
    if (normalizedData.schoolId && normalizedData.schoolName) {
      normalizedData.schoolIds = [normalizedData.schoolId];
      normalizedData.schoolNames = [normalizedData.schoolName];
    }
    
    if (normalizedData.schoolIds && Array.isArray(normalizedData.schoolIds)) {
      normalizedData.schoolIds = normalizedData.schoolIds.map(id => {
        const raw = String(id || '').trim();
        if (!raw) return raw;
        // Canonical IDs are snake_case from `data/schools.ts`
        if (SCHOOLS.find((s) => s.id === raw)) return raw;
        const hyphenAsSnake = raw.replace(/-/g, '_');
        if (SCHOOLS.find((s) => s.id === hyphenAsSnake)) return hyphenAsSnake;
        // Best-effort normalization (snake_case)
        return raw
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
      });
    }

    // Canonicalize subjects so matching is consistent across the app.
    if (Array.isArray(normalizedData.subjects)) {
      normalizedData.subjects = Array.from(
        new Set(
          normalizedData.subjects
            .map((s) => normalizeSubjectId(typeof s === 'string' ? s : String(s ?? '')))
            .filter((s): s is string => !!s)
        )
      );
    }

    // Derive single-source-of-truth fields (provider.school_id / provider.school_name)
    // from the first selected school (primary school).
    if (Array.isArray(normalizedData.schoolIds) && normalizedData.schoolIds.length > 0) {
      (normalizedData as any).school_id = String(normalizedData.schoolIds[0] || '').trim() || undefined;
    }
    if (Array.isArray(normalizedData.schoolNames) && normalizedData.schoolNames.length > 0) {
      (normalizedData as any).school_name = String(normalizedData.schoolNames[0] || '').trim() || undefined;
    }

    // Update user with onboarding data
    await updateUser(session.userId, normalizedData);

    return { success: true };
  } catch (error) {
    console.error('Error saving onboarding progress:', error);
    return { success: false, error: 'Failed to save onboarding progress' };
  }
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Determine provider services from new services field or legacy flags
    const services = (user as any).services || [];
    const hasTutoring = services.includes('tutoring') || user.roles.includes('tutor') || user.isTutor === true;
    const hasCounseling = services.includes('college_counseling') || user.roles.includes('counselor') || user.isCounselor === true;

    // Determine final schoolIds and schoolNames
    let schoolIds: string[] = [];
    let schoolNames: string[] = [];
    
    // Priority 1: Use schoolIds from onboarding data (new format)
    if (user.schoolIds && user.schoolIds.length > 0) {
      schoolIds = user.schoolIds;
      schoolNames = user.schoolNames || [];
    }
    // Priority 2: Use new schoolId/schoolName fields (from ProviderOnboardingClient)
    else if ((user as any).schoolId && (user as any).schoolName) {
      schoolIds = [(user as any).schoolId];
      schoolNames = [(user as any).schoolName];
    }
    // Priority 3: Use legacy school field (plain string) for college counseling
    else if ((user as any).school && (user as any).school.trim()) {
      // Store as a single school name for now (can be enhanced later to match against SCHOOLS_LIST)
      schoolNames = [(user as any).school];
      // Try to find matching school ID if possible
      const matchedSchool = findSchoolByName((user as any).school);
      if (matchedSchool) {
        schoolIds = [matchedSchool.id];
      } else {
        // Best-effort snake_case normalization
        const normalized = String((user as any).school)
          .trim()
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
        schoolIds = [normalized];
      }
    }
    // Priority 4: Convert legacy school names to normalized IDs (migration)
    else if (user.schools && user.schools.length > 0) {
      const convertedSchools = user.schools
        .map(legacyName => {
          const school = findSchoolByName(legacyName);
          if (school) return { id: school.id, name: school.name };

          const normalized = String(legacyName || '')
            .trim()
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
          const byId =
            SCHOOLS.find((s) => s.id === normalized) || SCHOOLS.find((s) => s.id === normalized.replace(/-/g, '_'));
          if (byId) return { id: byId.id, name: byId.name };

          return null;
        })
        .filter((s): s is { id: string; name: string } => s !== null);
      
      schoolIds = convertedSchools.map(s => s.id);
      schoolNames = convertedSchools.map(s => s.name);
    }

    // School selection is optional; do not block onboarding completion.

    // Validate tutors have subjects
    if (hasTutoring && (!user.subjects || user.subjects.length === 0)) {
      return { success: false, error: 'Subjects are required for tutoring.' };
    }

    // Validate services were selected
    if (services.length === 0 && !hasTutoring && !hasCounseling) {
      return { success: false, error: 'Please select at least one service.' };
    }

    // Normalize schoolIds to ensure consistent matching
    const normalizedSchoolIds = schoolIds.length > 0 
      ? schoolIds.map(id => {
          const raw = String(id || '').trim();
          if (!raw) return raw;
          if (SCHOOLS.find((s) => s.id === raw)) return raw;
          const hyphenAsSnake = raw.replace(/-/g, '_');
          if (SCHOOLS.find((s) => s.id === hyphenAsSnake)) return hyphenAsSnake;
          return raw
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        })
      : undefined;

    // Mark onboarding as completed and update with normalized school data
    const updateData: any = {
      onboardingCompleted: true,
    };

    // Update services if provided
    if (services.length > 0) {
      updateData.services = services;
    }

    // Update school data if available
    if (normalizedSchoolIds && normalizedSchoolIds.length > 0) {
      updateData.schoolIds = normalizedSchoolIds;
      updateData.schoolNames = schoolNames.length > 0 ? schoolNames : undefined;
      // Single-source-of-truth fields for school filtering + display
      updateData.school_id = String(normalizedSchoolIds[0] || '').trim() || undefined;
      updateData.school_name = String((schoolNames && schoolNames[0]) || '').trim() || undefined;
    } else if ((user as any).school) {
      updateData.school = (user as any).school;
    }

    // Update virtual tours if provided
    if ((user as any).offersVirtualTours !== undefined && (user as any).offersVirtualTours !== null) {
      updateData.offersVirtualTours = (user as any).offersVirtualTours;
    }

    // Update profile image if provided
    if ((user as any).profileImageUrl !== undefined) {
      updateData.profileImageUrl = (user as any).profileImageUrl;
    }

    await updateUser(session.userId, updateData);

    return { success: true };
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return { success: false, error: 'Failed to complete onboarding' };
  }
}

