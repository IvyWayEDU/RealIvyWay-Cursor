import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readAvailabilityFile, readReservedSlotsFile } from '@/lib/availability/store.server';
import { 
  normalizeServiceType,
  normalizeServiceTypeOrNull,
  normalizeDateKey, 
  generateSlots,
  generateSlotsForBlocks,
  bindDateKeyAndMinutesToUtcDate,
  timeStringFromMinutes
} from '@/lib/availability/engine';
import { getSessions } from '@/lib/sessions/storage';
import { getUsers } from '@/lib/auth/storage';
import { UserRole } from '@/lib/auth/types';
import { normalizeSubjectToCanonical, subjectsMatch, normalizeSubjectId } from '@/lib/models/subjects';
// RATE LIMITING
import { checkBookingRateLimit, createRateLimitHeaders } from '@/lib/rate-limiting/index';
import { auth } from '@/lib/auth/middleware';

const QuerySchema = z.object({
  date: z.string(),
  serviceType: z.string(),
  subject: z.string().optional(),
  topic: z.string().optional(),
  schoolId: z.string().optional(),
});

/**
 * Service duration mapping (in minutes)
 * These durations are used to generate slots from availability ranges
 * 
 * SERVICE DURATIONS (using normalized snake_case):
 * - tutoring: 60 minutes
 * - test_prep: 60 minutes
 * - college_counseling: 60 minutes (counseling)
 * - virtual_tour: 60 minutes
 */
const SERVICE_DURATIONS: Record<string, number> = {
  'tutoring': 60,
  'test_prep': 60,
  'college_counseling': 60,
  'virtual_tour': 60,
};

// Business rule: all sessions must be booked at least 60 minutes in advance.
const LEAD_TIME_BUFFER_MINUTES = 60;

/**
 * Get service duration in minutes
 * Normalizes serviceType before lookup
 * Defaults to 60 minutes if service type is unknown
 */
function getServiceDuration(serviceType: string | null): number {
  if (!serviceType) return 60;
  const normalized = normalizeServiceType(serviceType);
  return SERVICE_DURATIONS[normalized] || 60;
}

/**
 * Check if a service type is a counselor service
 * Counselor services: college_counseling, virtual_tour
 */
function isCounselorService(serviceType: string | null): boolean {
  if (!serviceType) return false;
  const normalized = normalizeServiceType(serviceType);
  return normalized === 'college_counseling' || normalized === 'virtual_tour';
}

function isValidAvailabilityRowServiceType(value: unknown): value is 'tutoring' | 'college_counseling' | 'virtual_tour' {
  return value === 'tutoring' || value === 'college_counseling' || value === 'virtual_tour';
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeDayOfWeek(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Common variants:
    // - 0..6 (Sun..Sat)
    // - 1..7 (Mon..Sun) → map 7 → 0 for Sunday
    if (value >= 0 && value <= 6) return value;
    if (value >= 1 && value <= 7) return value === 7 ? 0 : value;
    return null;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v in DAY_NAME_TO_INDEX) return DAY_NAME_TO_INDEX[v];
    // Short forms: mon, tue, wed, thu, fri, sat, sun
    const short = v.slice(0, 3);
    if (short === 'sun') return 0;
    if (short === 'mon') return 1;
    if (short === 'tue') return 2;
    if (short === 'wed') return 3;
    if (short === 'thu') return 4;
    if (short === 'fri') return 5;
    if (short === 'sat') return 6;
  }
  return null;
}

function blockMatchesRequestedDay(blockDayOfWeek: unknown, requestedDayOfWeek: number): boolean {
  const normalized = normalizeDayOfWeek(blockDayOfWeek);
  return normalized !== null && normalized === requestedDayOfWeek;
}

/**
 * College counseling slot generation:
 * - Do NOT depend on subject
 * - Step size MUST equal durationMinutes
 * - Bind requested date + provider-local times into real UTC Date objects
 */
function generateCounselingSlotStartISOsFromBlocks(params: {
  blocksForDay: any[];
  dateKey: string;
  timeZone: string;
  durationMinutes: number;
}): string[] {
  const { blocksForDay, dateKey, timeZone, durationMinutes } = params;
  const out: string[] = [];
  const stepMs = Math.max(1, durationMinutes) * 60 * 1000;

  for (const block of blocksForDay) {
    const startMinutes = Number((block as any)?.startMinutes);
    const endMinutes = Number((block as any)?.endMinutes);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) continue;

    const startDateTime = bindDateKeyAndMinutesToUtcDate(dateKey, startMinutes, timeZone);
    let endDateTime = bindDateKeyAndMinutesToUtcDate(dateKey, endMinutes, timeZone);

    // Defensive: if a block crosses midnight, bind end to next day so end > start.
    if (endDateTime <= startDateTime) {
      endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
    }

    let cursor = startDateTime;
    while (cursor.getTime() + stepMs <= endDateTime.getTime()) {
      out.push(cursor.toISOString());
      cursor = new Date(cursor.getTime() + stepMs);
    }
  }

  return Array.from(new Set(out)).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

/**
 * Comprehensive provider eligibility check for a booking request
 * 
 * @param provider - Provider user object
 * @param request - Booking request parameters
 * @param request.serviceType - Service type (tutoring, test_prep, college_counseling, virtual_tour)
 * @param request.subject - Subject for tutoring/test_prep (required for these services)
 * @param request.schoolId - School ID for virtual_tour/college_counseling (optional)
 * @returns true if provider is eligible for this request, false otherwise
 */
function isProviderEligibleForRequest(
  provider: any,
  request: {
    serviceType: string | null;
    subject: string | null;
    schoolId?: string | null;
  }
): boolean {
  const { serviceType, subject, schoolId } = request;
  
  if (!serviceType) {
    return false; // Service type is required
  }
  
  const normalized = normalizeServiceType(serviceType);
  
  // Tutoring and test_prep require subject matching
  if (normalized === 'tutoring' || normalized === 'test_prep') {
    if (!subject) {
      return false; // Subject is required for tutoring/test_prep
    }
    
    // Check service eligibility first
    if (!isProviderEligibleForService(provider, normalized)) {
      return false;
    }
    
    // Check subject matching
    return doesProviderTeachSubject(provider, subject);
  }
  
  // Virtual tours require counselor eligibility and school matching
  if (normalized === 'virtual_tour') {
    if (!isProviderEligibleForService(provider, normalized)) {
      return false;
    }
    
    // If schoolId is provided, provider must have that school (EXACT match by provider.school_id).
    if (schoolId) {
      const pid =
        (typeof provider?.school_id === 'string' && provider.school_id.trim()
          ? provider.school_id.trim()
          : null) ??
        (Array.isArray(provider?.schoolIds) && provider.schoolIds.length > 0 ? String(provider.schoolIds[0] || '').trim() : null);
      return !!pid && pid === schoolId;
    }
    
    // If no schoolId, allow general counselors (but this is unusual for virtual tours)
    return true;
  }
  
  // College counseling requires counselor eligibility
  if (normalized === 'college_counseling') {
    if (!isProviderEligibleForService(provider, normalized)) {
      return false;
    }

    // College Counseling matching update:
    // School match is a PREFERENCE, not a requirement. Do NOT filter counselors out
    // based on school mismatch. Ordering + messaging is handled elsewhere.
    void schoolId;
    return true;
  }
  
  // Unknown service type
  return false;
}

/**
 * Check if a provider teaches a specific subject
 * For tutoring and test prep, providers must have the requested subject in their subjects array
 * 
 * Uses canonical subject keys for matching (case-insensitive, handles variations)
 * Test Prep is a SUBJECT, not a service - uses SAME matching logic as Math or English
 * 
 * STRICT MATCHING: Provider must have the exact subject in their subjects array
 * 
 * @param provider - Provider user object
 * @param requestedSubject - The subject being requested (e.g., "Math", "English & Language Arts", "Test Prep", "SAT", "ACT")
 * @returns true if provider teaches the subject, false otherwise
 */
function doesProviderTeachSubject(provider: any, requestedSubject: string | null): boolean {
  if (!requestedSubject) return false; // STRICT: Subject is required, no subject = not eligible
  
  // Get provider's subjects array (check both provider and profile)
  const providerSubjects = provider.subjects || provider.profile?.subjects || [];
  
  if (!Array.isArray(providerSubjects) || providerSubjects.length === 0) {
    return false; // No subjects = not eligible for any specific subject
  }
  
  // Step 3: Use normalization on both sides of the match
  // Normalize requested subject to canonical key
  // This handles all Test Prep variations: "Test Prep", "SAT", "ACT", "SAT Prep", etc. → "test_prep"
  const requestedCanonical = normalizeSubjectId(requestedSubject);
  if (!requestedCanonical) {
    // Requested subject doesn't normalize - don't match
    // [SUBJECT_NORMALIZATION] Log when subject doesn't normalize
    console.log('[SUBJECT_NORMALIZATION] Requested subject does not normalize to canonical key', {
      requestedSubject,
      requestedCanonical: null,
    });
    return false;
  }
  
  // Step 3: Use normalization on both sides of the match
  // Check if any provider subject matches the canonical key
  // A slot is valid ONLY if: canonical(providerSubject) === canonical(requestedSubject)
  // Note: Special handling for Test Prep "Other" is done at the call site (where serviceType context is available)
  const hasMatch = providerSubjects.some((providerSubject: string) => {
    const providerCanonical = normalizeSubjectId(providerSubject);
    const matches = providerCanonical === requestedCanonical;
    
    // [SUBJECT_NORMALIZATION] Log each subject comparison
    if (matches || requestedCanonical === 'test_prep' || providerCanonical === 'test_prep') {
      console.log('[SUBJECT_NORMALIZATION] Subject comparison', {
        requestedSubjectRaw: requestedSubject,
        requestedSubjectCanonical: requestedCanonical,
        providerSubjectRaw: providerSubject,
        providerSubjectCanonical: providerCanonical,
        matches,
      });
    }
    
    return matches;
  });
  
  // [SUBJECT_NORMALIZATION] Log final comparison result
  console.log('[SUBJECT_NORMALIZATION] Final subject comparison result', {
    requestedSubjectRaw: requestedSubject,
    requestedSubjectCanonical: requestedCanonical,
    providerSubjectsRaw: providerSubjects,
    providerSubjectsCanonical: providerSubjects.map((s: string) => normalizeSubjectId(s)).filter((s: string | null): s is string => s !== null),
    finalMatch: hasMatch,
  });
  
  return hasMatch;
}

/**
 * Comprehensive eligibility check for providers with strict precedence
 * 
 * Rules (STRICT PRECEDENCE):
 * - If isTutor is explicitly boolean false, provider is NOT eligible for tutoring/test_prep (even if roles includes tutor)
 * - If isCounselor is explicitly boolean false, provider is NOT eligible for counseling/virtual_tour (even if roles includes counselor)
 * - Only if isTutor and isCounselor are undefined should we fall back to roles array
 * - Missing or undefined signals = NOT eligible (defensive)
 * 
 * VIRTUAL TOURS AND COLLEGE COUNSELING:
 * - Both use the EXACT SAME eligibility logic: isCounselor === true OR roles.includes('counselor')
 * - School matching is enforced separately in the filtering logic
 */
function isProviderEligibleForService(
  provider: any,
  serviceType: string
): boolean {
  const normalized = normalizeServiceType(serviceType);
  
  // Determine what type of service is requested
  const tutorRequested = normalized === 'tutoring' || normalized === 'test_prep';
  const counselorRequested = normalized === 'college_counseling' || normalized === 'virtual_tour';
  
  // Check if explicit boolean flags exist
  const hasTutorFlag = typeof provider.isTutor === 'boolean';
  const hasCounselorFlag = typeof provider.isCounselor === 'boolean';
  
  // Handle tutor services (tutoring, test_prep)
  // Eligibility is determined by enabled services, not just role flags
  if (tutorRequested) {
    // Get services array (check both provider and profile)
    const services = provider.services || provider.profile?.services || [];
    
    // Service-based eligibility check
    // Provider is eligible if services array includes the requested service
    // For test_prep, also allow if services includes "tutoring"
    const isServiceEnabled = Array.isArray(services) && (
      services.includes(normalized) ||
      (normalized === 'test_prep' && services.includes('tutoring'))
    );
    
    if (isServiceEnabled) {
      return true;
    }
    
    // Fallback: if services array doesn't exist or is empty, check role flags
    // This maintains backward compatibility and ensures we don't loosen eligibility
    // for users without tutoring enabled
    if (!Array.isArray(services) || services.length === 0) {
      if (hasTutorFlag) {
        // Explicit flag exists - use it as fallback
        return provider.isTutor === true;
      } else {
        // No explicit flag - fall back to roles array
        const roles = provider.roles || provider.profile?.roles || [];
        const serviceTypes = provider.serviceTypes || provider.profile?.serviceTypes || [];
        
        // Check for explicit tutor signal in roles or serviceTypes
        const hasTutorRole = Array.isArray(roles) && roles.includes('tutor');
        const hasTutorServiceType = Array.isArray(serviceTypes) && (
          serviceTypes.includes('tutoring') ||
          serviceTypes.includes('test_prep') ||
          serviceTypes.includes('tutor')
        );
        
        return hasTutorRole || hasTutorServiceType;
      }
    }
    
    // Services array exists but doesn't include the requested service
    return false;
  }
  
  // Handle counselor services (college_counseling, virtual_tour)
  // Both use the EXACT SAME eligibility logic
  if (counselorRequested) {
    // Shared counselor eligibility logic for both college_counseling and virtual_tour
    const isCounselorEligible = hasCounselorFlag
      ? provider.isCounselor === true
      : (Array.isArray(provider.roles) && provider.roles.includes('counselor')) ||
        (Array.isArray(provider.profile?.roles) && provider.profile.roles.includes('counselor'));
    
    // Add debug log for virtual tours
    if (normalized === 'virtual_tour') {
      console.log('[VIRTUAL_TOUR_ELIGIBILITY]', {
        providerId: provider.id,
        roles: provider.roles,
        isCounselor: provider.isCounselor,
        schoolId: provider.schoolId,
        eligible: isCounselorEligible
      });
    }
    
    return isCounselorEligible;
  }
  
  // Unknown service type = NOT eligible
  return false;
}

/**
 * GET /api/availability/all-slots?date=YYYY-MM-DD&serviceType=xxx
 * Get all available time slots from all providers for a specific date
 * 
 * Required query params:
 * - date
 * - serviceType
 * 
 * Returns array of:
 * {
 *   providerId,
 *   startTimeISO,
 *   displayTime
 * }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    // RATE LIMITING: Check booking rate limit (prevent rapid-fire availability queries)
    // Note: This endpoint is public (used for booking flow), so we use IP-based limiting
    const { getSession } = await import('@/lib/auth/session');
    const session = await getSession();
    const userId = session?.userId || null;
    const rateLimitResult = checkBookingRateLimit(req, userId, '/api/availability/all-slots');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before querying availability again.' },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const parsed = QuerySchema.safeParse({
      date: searchParams.get('date'),
      serviceType: searchParams.get('serviceType'),
      subject: searchParams.get('subject') ?? undefined,
      topic: searchParams.get('topic') ?? undefined,
      schoolId: searchParams.get('schoolId') ?? undefined,
    });

    if (!parsed.success) {
      console.error('Invalid query:', parsed.error);
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const {
      date: dateStr,
      serviceType,
      subject: subjectParam,
      schoolId: schoolIdParam,
    } = parsed.data;
    const schoolNameParam = searchParams.get('schoolName') ?? undefined;

    // Apply standard normalization if provided (optional)
    // virtual_tour must remain virtual_tour - never normalize to college_counseling
    const originalServiceType = serviceType;
    let normalizedServiceType: string | null = null;
    if (!serviceType) {
      return NextResponse.json({ error: 'Missing serviceType' }, { status: 400 });
    }
    try {
      normalizedServiceType = normalizeServiceTypeOrNull(serviceType);
    } catch (e) {
      console.warn('[AVAILABILITY_ALL_SLOTS] Invalid serviceType query param', {
        serviceType,
        error: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 });
    }
    
    // CRITICAL: Normalize test_prep to tutoring EARLY for behavioral parity
    // Test prep must behave IDENTICALLY to tutoring in availability logic
    // This ensures same-day slots appear and no special lead time rules apply
    const originalNormalizedServiceType = normalizedServiceType; // Preserve for response
    if (normalizedServiceType === 'test_prep') {
      console.log('[TEST_PREP_AVAILABILITY] Using tutoring availability rules');
      normalizedServiceType = 'tutoring';
    }
    
    // Guard: ensure virtual_tour returns virtual_tour
    if (normalizedServiceType === 'virtual_tour') {
      normalizedServiceType = 'virtual_tour';
    }
    
    // Map virtual_tour to college_counseling for availability lookup
    // Virtual tours reuse counselor availability, but booking serviceType remains virtual_tour
    let availabilityServiceType: string | null = null;
    if (normalizedServiceType === 'virtual_tour') {
      availabilityServiceType = 'college_counseling';
    } else {
      availabilityServiceType = normalizedServiceType;
    }

    if (!availabilityServiceType) {
      return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 });
    }
    
    // Strict filtering requirement: do NOT accept null/undefined serviceType rows.
    // Availability rows must have explicit serviceType populated.
    const allowsNull = false;
    
    // [AVAILABILITY_SERVICE_USED] Debug log
    console.log('[AVAILABILITY_SERVICE_USED]', {
      requestedService: normalizedServiceType,
      availabilityServiceUsed: availabilityServiceType,
    });
    
    // [AVAILABILITY_QUERY_FILTER] Debug log
    console.log('[AVAILABILITY_QUERY_FILTER]', {
      availabilityServiceType,
      allowsNull: allowsNull
    });
    
    // [SERVICE_TYPE_FINAL] Debug log after normalization
    if (normalizedServiceType) {
      console.log('[SERVICE_TYPE_FINAL]', normalizedServiceType);
    }

    // Detect when requestedService === 'college_counseling' (must not depend on tutoring/subject logic)
    const isCollegeCounselingRequest = normalizedServiceType === 'college_counseling';

    // Use availabilityServiceType for duration calculation
    // VIRTUAL TOUR: Force 60 minutes
    // College counseling is 60 minutes only
    let durationMinutes = getServiceDuration(availabilityServiceType || normalizedServiceType);
    if (normalizedServiceType === 'virtual_tour') {
      durationMinutes = 60; // Force 60 minutes for virtual tours
    }

    // Optional duration override (historical). Counseling no longer supports 30-minute sessions.
    // Only allow for college counseling to avoid changing other services unexpectedly.
    const durationMinutesParam = searchParams.get('durationMinutes');
    const parsedDuration = durationMinutesParam ? parseInt(durationMinutesParam, 10) : NaN;
    if (
      availabilityServiceType === 'college_counseling' &&
      Number.isFinite(parsedDuration) &&
      parsedDuration === 60
    ) {
      durationMinutes = parsedDuration;
    }
    
    // [SCHOOL_MATCH_DEBUG] Log incoming parameters
    console.log(`[SCHOOL_MATCH_DEBUG] serviceType=${normalizedServiceType || 'none'}, schoolId=${schoolIdParam || 'none'}, schoolName=${schoolNameParam || 'none'}`);
    
    // Normalize date to YYYY-MM-DD format in America/New_York timezone
    const dateKey = normalizeDateKey(dateStr);
    
    // Parse dateKey to get dayOfWeek (0-6, Sunday-Saturday) in America/New_York
    const [year, month, day] = dateKey.split('-').map(Number);
    const tzDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
    });
    const dayName = formatter.format(tzDate);
    const dayOfWeekMap: Record<string, number> = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
    };
    const dayOfWeek = dayOfWeekMap[dayName] ?? 0;
    
    // Read all availability from store.server.ts
    const availabilityStorage = await readAvailabilityFile();

    // Read reserved slots once and build a fast lookup set
    const reservedSlots = await readReservedSlotsFile();
    const reservedSet = new Set(
      reservedSlots
        .filter((s) => (s.status ?? 'available') === 'reserved')
        .map((s) => `${s.providerId}|${s.startTime}|${s.endTime}`)
    );
    
    // Get all sessions to filter out booked slots
    const allSessions = await getSessions();
    
    // Get all users to check provider roles and filter
    const allUsers = await getUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    // If serviceType is provided, filter providers by their roles
    let providerIdsToInclude: Set<string> | null = null;
    if (normalizedServiceType) {
      providerIdsToInclude = new Set<string>();
      
      for (const entry of Object.values(availabilityStorage)) {
        const providerId = (entry as any)?.providerId;
        const entryServiceTypeRaw = (entry as any)?.serviceType;
        if (!isValidAvailabilityRowServiceType(entryServiceTypeRaw)) {
          console.warn('[AVAILABILITY_INVALID_ROW_SERVICE_TYPE]', {
            providerId: providerId || null,
            serviceType: entryServiceTypeRaw ?? null,
          });
          continue;
        }
        const user = providerId ? userMap.get(providerId) : null;
        if (!user) continue;
        
        // Check eligibility and prepare debug info
        const hasTutorFlag = typeof (user as any).isTutor === 'boolean';
        const hasCounselorFlag = typeof (user as any).isCounselor === 'boolean';
        const eligible = isProviderEligibleForService(user, normalizedServiceType);
        
        // [ELIGIBILITY_DEBUG] Log eligibility check for each provider
        console.log('[ELIGIBILITY_DEBUG]', {
          providerId: user.id,
          requestedService: normalizedServiceType,
          isTutor: (user as any).isTutor,
          isCounselor: (user as any).isCounselor,
          roles: user.roles,
          services: (user as any).services || (user as any).profile?.services,
          usedFlags: {
            hasTutorFlag,
            hasCounselorFlag
          },
          eligible
        });
        
        if (!eligible) {
          continue; // Skip providers not eligible for the service
        }
        
        // For tutoring (and test_prep, now normalized to tutoring): apply STRICT subject-based filtering
        // This ensures providers only appear for subjects they actually teach
        // Test Prep is a SUBJECT, not a service - use SAME subject-matching path as Math or English
        if (normalizedServiceType === 'tutoring') {
          // Subject is REQUIRED for tutoring/test_prep - validation should catch this, but double-check
          if (!subjectParam) {
            continue; // Skip if subject is missing (should not happen due to validation)
          }
          
          // Use the comprehensive subject matching function
          if (!doesProviderTeachSubject(user, subjectParam)) {
            continue; // Skip providers who don't teach the requested subject
          }
        }
        
        providerIdsToInclude.add(providerId);
      }
    }
    
    // Virtual Tours ONLY: strict provider school matching is enforced here.
    // College Counseling: school match is preference-only (ordering + messaging), never a hard filter.
    let schoolFilterClause = 'none';
    if (schoolIdParam && normalizedServiceType === 'virtual_tour') {
      const beforeCount = providerIdsToInclude ? providerIdsToInclude.size : Object.keys(availabilityStorage).length;
      
      // Helper function to normalize school name for fallback matching
      const normalizeSchoolNameForMatch = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s]/g, '') // Remove punctuation
          .replace(/\s+/g, ' '); // Collapse whitespace
      };
      
      // Filter providerIdsToInclude by schoolId
      if (providerIdsToInclude) {
        const filteredProviderIds = new Set<string>();
        
        for (const providerId of providerIdsToInclude) {
          const user = userMap.get(providerId);
          if (!user) continue;
          
          // Check if provider has this schoolId
          const providerSchoolIds = user.schoolIds || [];
          if (providerSchoolIds.includes(schoolIdParam)) {
            filteredProviderIds.add(providerId);
            continue;
          }
          
          // Fallback: match by normalized schoolName if schoolId not found
          if (schoolNameParam) {
            const normalizedRequestName = normalizeSchoolNameForMatch(schoolNameParam);
            const providerSchoolNames = user.schoolNames || [];
            
            // Check if any provider school name matches (normalized)
            let nameMatch = false;
            for (const providerSchoolName of providerSchoolNames) {
              const normalizedProviderName = normalizeSchoolNameForMatch(providerSchoolName);
              if (normalizedProviderName === normalizedRequestName) {
                nameMatch = true;
                break;
              }
            }
            
            // Also check legacy schools field
            if (!nameMatch && user.schools && user.schools.length > 0) {
              for (const legacySchool of user.schools) {
                const normalizedLegacyName = normalizeSchoolNameForMatch(legacySchool);
                if (normalizedLegacyName === normalizedRequestName) {
                  nameMatch = true;
                  break;
                }
              }
            }
            
            if (nameMatch) {
              filteredProviderIds.add(providerId);
              continue;
            }
          }
          
          // For virtual tours: strict schoolId matching (no fallback, no string matching)
          // Virtual tours require exact schoolId match - providers must have the requested schoolId
          if (normalizedServiceType === 'virtual_tour') {
            // Only match by schoolId, no fallback to name matching or general counselors
            continue; // Skip this provider - strict schoolId matching required (already checked above)
          }
          
          // For counseling: allow general counselors (no school tags) as fallback
          if (normalizedServiceType === 'college_counseling') {
            const providerSchoolIds = user.schoolIds || [];
            const providerSchoolNames = user.schoolNames || [];
            const hasLegacySchools = user.schools && user.schools.length > 0;
            // General counselor: no schools specified
            if (providerSchoolIds.length === 0 && providerSchoolNames.length === 0 && !hasLegacySchools) {
              filteredProviderIds.add(providerId);
            }
          }
        }
        
        providerIdsToInclude = filteredProviderIds;
      } else {
        // If no serviceType filter, create a new set and filter by school
        providerIdsToInclude = new Set<string>();
        
        for (const entry of Object.values(availabilityStorage)) {
          const providerId = (entry as any)?.providerId;
          const user = providerId ? userMap.get(providerId) : null;
          if (!user) continue;
          
          // Check if provider has this schoolId
          const providerSchoolIds = user.schoolIds || [];
          if (providerSchoolIds.includes(schoolIdParam)) {
            providerIdsToInclude.add(providerId);
            continue;
          }
          
          // For virtual tours: strict schoolId matching only (no fallback to name matching)
          if (normalizedServiceType === 'virtual_tour') {
            // Skip this provider - Virtual Tours require exact schoolId match, no fallback
            continue;
          }
          
          // Fallback: match by normalized schoolName if schoolId not found (only for counseling)
          if (schoolNameParam && normalizedServiceType === 'college_counseling') {
            const normalizedRequestName = normalizeSchoolNameForMatch(schoolNameParam);
            const providerSchoolNames = user.schoolNames || [];
            
            // Check if any provider school name matches (normalized)
            let nameMatch = false;
            for (const providerSchoolName of providerSchoolNames) {
              const normalizedProviderName = normalizeSchoolNameForMatch(providerSchoolName);
              if (normalizedProviderName === normalizedRequestName) {
                nameMatch = true;
                break;
              }
            }
            
            // Also check legacy schools field
            if (!nameMatch && user.schools && user.schools.length > 0) {
              for (const legacySchool of user.schools) {
                const normalizedLegacyName = normalizeSchoolNameForMatch(legacySchool);
                if (normalizedLegacyName === normalizedRequestName) {
                  nameMatch = true;
                  break;
                }
              }
            }
            
            if (nameMatch) {
              providerIdsToInclude.add(providerId);
              providerIdsToInclude.add(providerId);
              continue;
            }
          }
          
          // For virtual tours: strict schoolId matching (no fallback, no string matching)
          // Virtual tours require exact schoolId match - providers must have the requested schoolId
          if (normalizedServiceType === 'virtual_tour') {
            // Only match by schoolId, no fallback to name matching or general counselors
            continue; // Skip this provider - strict schoolId matching required (already checked above)
          }
          
          // For counseling: allow general counselors (no school tags) as fallback
          if (normalizedServiceType === 'college_counseling') {
            const providerSchoolIds = user.schoolIds || [];
            const providerSchoolNames = user.schoolNames || [];
            const hasLegacySchools = user.schools && user.schools.length > 0;
            // General counselor: no schools specified
            if (providerSchoolIds.length === 0 && providerSchoolNames.length === 0 && !hasLegacySchools) {
              providerIdsToInclude.add(providerId);
            }
          }
        }
      }
      
      const afterCount = providerIdsToInclude ? providerIdsToInclude.size : 0;
      schoolFilterClause = `schoolId=${schoolIdParam} (matched ${afterCount} of ${beforeCount} providers)`;
      
      // [SCHOOL_MATCH_DEBUG] Log school filtering results
      console.log(`[SCHOOL_MATCH_DEBUG] ${schoolFilterClause}`);
    }
    
      // [AVAILABILITY_TUTORING_DEBUG] Debug log before querying availability rows
      const matchedProviderIds = providerIdsToInclude ? Array.from(providerIdsToInclude) : [];
      console.log('[AVAILABILITY_TUTORING_DEBUG]', {
        requestedService: normalizedServiceType,
        availabilityServiceUsed: availabilityServiceType,
        availabilityServiceType: availabilityServiceType,
        allowsNull: allowsNull,
        schoolId: schoolIdParam || null,
        matchedProviderIds: matchedProviderIds,
      });
      
      // Step 1: Log final counts before querying availability rows
      const eligibleProvidersCount = providerIdsToInclude ? providerIdsToInclude.size : 0;
      const subjectMatchedProvidersCount = eligibleProvidersCount; // Already filtered by subject above
      console.log('[TEST_PREP_DEBUG] Final counts before availability query', {
        eligibleProvidersCount: eligibleProvidersCount,
        subjectMatchedProvidersCount: subjectMatchedProvidersCount,
      });
    
    // Collect slots from all providers
    const allSlots: Array<{
      providerId: string;
      startTimeISO: string;
      displayTime: string;
      startMinutes: number;
      isTutor: boolean;
      isCounselor: boolean;
    }> = [];

    // Debug: ensure time-only availability is bound to requested date before any comparisons/slot generation.
    let didLogAfterDateBinding = false;
    
    // Count matching availability rows for debug log
    let availabilityRowCount = 0;
    const availabilityRows: any[] = [];
    const countsByServiceType: Record<string, number> = {};
    let exampleRow: any = null;
    for (const entry of Object.values(availabilityStorage)) {
      const providerId = (entry as any)?.providerId;
      if (!providerId) continue;

      const entryServiceTypeRaw = (entry as any)?.serviceType;
      if (!isValidAvailabilityRowServiceType(entryServiceTypeRaw)) {
        console.warn('[AVAILABILITY_INVALID_ROW_SERVICE_TYPE]', {
          providerId,
          serviceType: entryServiceTypeRaw ?? null,
        });
        continue;
      }

      // Filter by explicit availability.serviceType (no null/undefined fallback)
      if (entryServiceTypeRaw !== availabilityServiceType) continue;
      
      // Skip providers that don't offer the requested service
      if (providerIdsToInclude && !providerIdsToInclude.has(providerId)) {
        continue;
      }
      
      // Additional defensive check
      if (normalizedServiceType) {
        const user = userMap.get(providerId);
        if (!user || !isProviderEligibleForService(user, normalizedServiceType)) {
          continue;
        }
      }
      
      availabilityRowCount++;
      availabilityRows.push(entry);
      
      // Collect statistics for debug log
      const entryServiceType = String((entry as any).serviceType || '');
      const serviceTypeKey = entryServiceType || 'unknown';
      countsByServiceType[serviceTypeKey] = (countsByServiceType[serviceTypeKey] || 0) + 1;
      
      // Store first example row
      if (!exampleRow && entry.blocks && entry.blocks.length > 0) {
        const firstBlock = entry.blocks[0];
        exampleRow = {
          id: `${providerId}:${entryServiceType || 'unknown'}`,
          providerId: providerId,
          serviceType: entryServiceType,
          startTimeUTC: firstBlock.startMinutes !== undefined ? timeStringFromMinutes(firstBlock.startMinutes) : null,
          endTimeUTC: firstBlock.endMinutes !== undefined ? timeStringFromMinutes(firstBlock.endMinutes) : null,
        };
      }
    }
    
    // [AVAILABILITY_TUTORING_ROWS] Debug log after fetching availability rows
    console.log('[AVAILABILITY_TUTORING_ROWS]', {
      rowCount: availabilityRowCount,
      countsByServiceType: countsByServiceType,
      exampleRow: exampleRow,
    });
    
    // Safety check: if requestedService is tutoring (or was test_prep) and rows are still zero
    if (normalizedServiceType === 'tutoring' && availabilityRowCount === 0) {
      const providerCount = providerIdsToInclude ? providerIdsToInclude.size : 0;
      console.log('[AVAILABILITY_TUTORING_ZERO]', {
        requestedService: normalizedServiceType,
        availabilityServiceUsed: availabilityServiceType,
        availabilityServiceType: availabilityServiceType,
        allowsNull: allowsNull,
        schoolId: schoolIdParam || null,
        matchedProviderIds: matchedProviderIds,
        providerCount: providerCount,
        rowCount: availabilityRowCount,
        countsByServiceType: countsByServiceType,
      });
    }
    
    // [VIRTUAL_TOUR_DEBUG] Log before slot generation
    console.log('[VIRTUAL_TOUR_DEBUG]', {
      requestedService: normalizedServiceType,
      availabilityServiceUsed: availabilityServiceType,
      durationMinutes,
      slotStepMinutes: durationMinutes, // generateSlots uses durationMinutes as step
      providerCount: providerIdsToInclude ? providerIdsToInclude.size : 0,
      availabilityRowCount,
    });
    
    // Iterate through availability entries
    // Availability is provider-level, not service-specific, so we get all entries
    // IMPORTANT: Virtual tours reuse college counseling availability blocks
    // - Virtual tours use the same availability blocks as college counseling
    // - No separate availability is required for virtual tours
    // - School matching is enforced in the provider filtering logic above
    // Attach explicit request date context to time-only availability rows.
    // Availability rows themselves are not date-specific; we bind the requested date during slot generation.
    const requestedDateISO = dateKey;
    const requestedDateDayOfWeek = dayOfWeek;
    const mappedRows = availabilityRows.map((r) => ({
      ...(r as any),
      date: requestedDateISO,
      dayOfWeek: requestedDateDayOfWeek,
    }));

    // [AVAILABILITY_ROWS_AFTER_FIX] must not drop rows (rowCount should match [AVAILABILITY_TUTORING_ROWS].rowCount)
    console.log('[AVAILABILITY_ROWS_AFTER_FIX]', {
      rowCount: mappedRows.length,
      sample: mappedRows[0]
        ? {
            providerId: (mappedRows[0] as any)?.providerId ?? null,
            serviceType: (mappedRows[0] as any)?.serviceType ?? null,
            date: (mappedRows[0] as any)?.date ?? null,
            dayOfWeek: (mappedRows[0] as any)?.dayOfWeek ?? null,
            blocksCount: Array.isArray((mappedRows[0] as any)?.blocks) ? (mappedRows[0] as any).blocks.length : 0,
            firstBlock: Array.isArray((mappedRows[0] as any)?.blocks) ? (mappedRows[0] as any).blocks[0] : null,
          }
        : null,
    });

    // Counseling-only debug + invariant-supporting input rowCount.
    // rowCount here means: rows that pass eligibility + school match + have >=1 block that yields >=1 slot
    // (and yields >=1 slot AFTER the lead-time buffer filter).
    let counselingAvailabilityInputRowCount = 0;
    if (isCollegeCounselingRequest) {
      const nowUTCForFiltering = new Date();
      const cutoffUTCForFiltering = new Date(
        nowUTCForFiltering.getTime() + LEAD_TIME_BUFFER_MINUTES * 60 * 1000
      );

      for (const entry of mappedRows) {
        const providerId = (entry as any)?.providerId;
        if (!providerId) continue;

        const entryServiceTypeRaw = (entry as any)?.serviceType;
        if (!isValidAvailabilityRowServiceType(entryServiceTypeRaw)) continue;

        // College counseling MUST ONLY use blocks for serviceType === 'college_counseling'
        if (entryServiceTypeRaw !== 'college_counseling') continue;

        // School match + provider eligibility are enforced by providerIdsToInclude
        if (providerIdsToInclude && !providerIdsToInclude.has(providerId)) continue;

        const user = userMap.get(providerId);
        if (!user || !isProviderEligibleForService(user, 'college_counseling')) continue;

        const allBlocks = Array.isArray((entry as any).blocks) ? (entry as any).blocks : [];
        const blocksForDay = allBlocks.filter((block: any) =>
          blockMatchesRequestedDay(block?.dayOfWeek, requestedDateDayOfWeek)
        );
        if (blocksForDay.length === 0) continue;

        const tz = (entry as any)?.timezone || 'America/New_York';
        const slotISOs = generateCounselingSlotStartISOsFromBlocks({
          blocksForDay,
          dateKey,
          timeZone: tz,
          durationMinutes,
        });

        if (slotISOs.length === 0) continue;

        // Count the row only if it can produce at least one AVAILABLE slot after the same filters
        // applied in the final response (lead-time buffer, booked sessions, reserved slots).
        const hasAtLeastOneAvailableSlot = slotISOs.some((startTimeISO) => {
          // Mirror the lead-time buffer filter (UTC-based, applies to all services).
          if (new Date(startTimeISO).getTime() <= cutoffUTCForFiltering.getTime()) return false;

          const endTimeISO = new Date(new Date(startTimeISO).getTime() + durationMinutes * 60 * 1000).toISOString();
          const reservationKey = `${providerId}|${startTimeISO}|${endTimeISO}`;
          if (reservedSet.has(reservationKey)) return false;

          const isBooked = allSessions.some(session => {
            if (session.status !== 'upcoming' && session.status !== 'paid' && session.status !== 'scheduled') {
              return false;
            }
            const sessionStart = new Date(session.scheduledStartTime);
            const sessionEnd = new Date(session.scheduledEndTime);
            const slotStart = new Date(startTimeISO);
            const slotEnd = new Date(endTimeISO);
            return sessionStart < slotEnd && sessionEnd > slotStart && session.providerId === providerId;
          });
          return !isBooked;
        });

        if (hasAtLeastOneAvailableSlot) {
          counselingAvailabilityInputRowCount++;
        }
      }

      console.log('[COUNSELING_AVAILABILITY_INPUT]', {
        rowCount: counselingAvailabilityInputRowCount,
        dateKey,
        durationMinutes,
      });
    }

    // Debug: log availability rows BEFORE slot generation (do not drop rows here; only compute blocksForRequestedDayCount)
    const rowsBeforeSlotGen: Array<{ providerId: string; serviceType: string; blocksForRequestedDayCount: number }> = [];

    for (const entry of mappedRows) {
      const providerId = (entry as any)?.providerId;
      if (!providerId) continue;

      const entryServiceTypeRaw = (entry as any)?.serviceType;
      if (!isValidAvailabilityRowServiceType(entryServiceTypeRaw)) {
        console.warn('[AVAILABILITY_INVALID_ROW_SERVICE_TYPE]', {
          providerId,
          serviceType: entryServiceTypeRaw ?? null,
        });
        continue;
      }

      // Filter by explicit availability.serviceType (no null/undefined fallback)
      if (entryServiceTypeRaw !== availabilityServiceType) continue;
      
      // Skip providers that don't offer the requested service (if serviceType was provided)
      if (providerIdsToInclude && !providerIdsToInclude.has(providerId)) {
        continue;
      }
      
      // Eligibility check:
      // - college_counseling MUST NOT depend on subject matching
      // - other services keep existing comprehensive request eligibility
      const user = userMap.get(providerId);
      if (!user) continue;
      if (isCollegeCounselingRequest) {
        if (!isProviderEligibleForService(user, 'college_counseling')) continue;
      } else {
        if (!isProviderEligibleForRequest(user, {
          serviceType: normalizedServiceType,
          subject: subjectParam || null,
          schoolId: schoolIdParam || null,
        })) {
          continue;
        }
      }
      
      // Find blocks for this dayOfWeek
      // These blocks are reused for both college_counseling and virtual_tour services
      const allBlocks = Array.isArray((entry as any).blocks) ? (entry as any).blocks : [];
      const blocksForDay = allBlocks.filter((block: any) => blockMatchesRequestedDay(block?.dayOfWeek, requestedDateDayOfWeek));

      rowsBeforeSlotGen.push({
        providerId,
        serviceType: entryServiceTypeRaw,
        blocksForRequestedDayCount: blocksForDay.length,
      });

      // [AVAILABILITY_ROWS_AFTER_DATE_BINDING] Bind the requested booking date to provider-local availability times.
      // We convert once to UTC (no double conversion) and only compare Date-to-Date downstream.
      if (!didLogAfterDateBinding) {
        const tz = (entry as any)?.timezone || 'America/New_York';
        const firstBlock = blocksForDay[0];
        const startMinutes = Number(firstBlock?.startMinutes);
        const endMinutes = Number(firstBlock?.endMinutes);

        const startDateTime = Number.isFinite(startMinutes)
          ? bindDateKeyAndMinutesToUtcDate(dateKey, startMinutes, tz)
          : null;
        let endDateTime = Number.isFinite(endMinutes)
          ? bindDateKeyAndMinutesToUtcDate(dateKey, endMinutes, tz)
          : null;

        // Defensive: if a block crosses midnight, bind end to next day so end > start.
        if (startDateTime && endDateTime && endDateTime <= startDateTime) {
          endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
        }

        console.log('[AVAILABILITY_ROWS_AFTER_DATE_BINDING]', {
          dateKey,
          providerId,
          serviceType: entryServiceTypeRaw,
          timeZone: tz,
          sample: {
            startMinutes,
            endMinutes,
            startDateTime,
            endDateTime,
            startDateTimeUTC: startDateTime?.toISOString?.() || null,
            endDateTimeUTC: endDateTime?.toISOString?.() || null,
          },
        });
        didLogAfterDateBinding = true;
      }
      
      // Generate all slots for this provider's blocks using the new function
      // Use consistent slotIntervalMinutes (60) and sessionDurationMinutes
      if (blocksForDay.length === 0) {
        continue;
      }
      let slotISOs: string[] = [];
      if (isCollegeCounselingRequest) {
        slotISOs = generateCounselingSlotStartISOsFromBlocks({
          blocksForDay,
          dateKey,
          timeZone: (entry as any)?.timezone || 'America/New_York',
          durationMinutes,
        });
      } else {
        const slotIntervalMinutes = 60;
        slotISOs = generateSlotsForBlocks(
          blocksForDay,
          dateKey,
          {
            slotIntervalMinutes,
            sessionDurationMinutes: durationMinutes,
            roundToInterval: true,
            timeZone: (entry as any)?.timezone || 'America/New_York',
          }
        );
      }
      
      // Debug logging (dev only)
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        const now = new Date();
        const leadTimeMinutes = 0; // No lead time for now (can be added later)
        console.log('[SLOT_GENERATION_DEBUG]', {
          requestedServiceType: originalServiceType || normalizedServiceType,
          requestedSubject: subjectParam || null,
          requestedDate: dateKey,
          nowTimestamp: now.toISOString(),
          leadTimeMinutes,
          providerId,
          providerSubjects: (user as any).subjects || (user as any).profile?.subjects || [],
          blocks: blocksForDay.map((b: any) => ({
            start: timeStringFromMinutes(b?.startMinutes),
            end: timeStringFromMinutes(b?.endMinutes),
          })),
          generatedSlotCount: slotISOs.length,
        });
      }
      
      // Process each generated slot
      for (const startTimeISO of slotISOs) {
          // Check if this slot is already booked
          const endTimeISO = new Date(new Date(startTimeISO).getTime() + durationMinutes * 60 * 1000).toISOString();
          
          const isBooked = allSessions.some(session => {
            // Only check active bookings
            if (session.status !== 'upcoming' && session.status !== 'paid' && session.status !== 'scheduled') {
              return false;
            }
            
            // Check if session overlaps with this slot
            const sessionStart = new Date(session.scheduledStartTime);
            const sessionEnd = new Date(session.scheduledEndTime);
            const slotStart = new Date(startTimeISO);
            const slotEnd = new Date(endTimeISO);
            
            // Overlap check: sessionStart < slotEnd AND sessionEnd > slotStart
            return sessionStart < slotEnd && sessionEnd > slotStart && session.providerId === providerId;
          });
          
          const reservationKey = `${providerId}|${startTimeISO}|${endTimeISO}`;
          const isReserved = reservedSet.has(reservationKey);

          if (!isBooked && !isReserved) {
            // Get provider role info
            const user = userMap.get(providerId);
            const isTutor = user ? (user.isTutor ?? user.roles.includes('tutor')) : false;
            const isCounselor = user ? (user.isCounselor ?? user.roles.includes('counselor')) : false;
            
            // Convert ISO to display time for compatibility (in America/New_York timezone)
            const slotDate = new Date(startTimeISO);
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: 'numeric',
              hour12: false,
            });
            const parts = formatter.formatToParts(slotDate);
            const slotHours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
            const slotMins = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
            const startMinutes = slotHours * 60 + slotMins;
            
            allSlots.push({
              providerId: providerId,
              startTimeISO,
              displayTime: timeStringFromMinutes(startMinutes),
              startMinutes,
              isTutor,
              isCounselor,
            });
          }
        }
      }
    
    // Sort slots by startTimeISO
    allSlots.sort((a, b) => new Date(a.startTimeISO).getTime() - new Date(b.startTimeISO).getTime());

    console.log('[AVAILABILITY_ROWS_BEFORE_SLOT_GENERATION]', {
      requestedService: normalizedServiceType,
      availabilityServiceUsed: availabilityServiceType,
      rowCount: rowsBeforeSlotGen.length,
      sample: rowsBeforeSlotGen.slice(0, 25),
    });
    
    // Step 1: Log final counts after generating slots
    const availabilityRowsCount = availabilityRowCount;
    const slotsCount = allSlots.length;
    console.log('[TEST_PREP_DEBUG] Final counts after slot generation', {
      eligibleProvidersCount: eligibleProvidersCount,
      subjectMatchedProvidersCount: subjectMatchedProvidersCount,
      availabilityRowsCount: availabilityRowsCount,
      slotsCount: slotsCount,
    });
    
    // Format response as requested: { startTimeUTC, endTimeUTC, providerId, serviceType, schoolId, schoolName }
    const slots = allSlots.map(slot => {
      const startTimeUTC = slot.startTimeISO;
      const endTimeUTC = new Date(new Date(startTimeUTC).getTime() + durationMinutes * 60 * 1000).toISOString();
      
      // For counselor services, use provider's school info from profile
      let slotSchoolId: string | null = null;
      let slotSchoolName: string | null = null;
      
      if (normalizedServiceType === 'college_counseling') {
        const provider = userMap.get(slot.providerId);
        if (provider) {
          // For college counseling, use provider's schoolId and schoolName from arrays
          // Only use null if provider.schoolIds is null/empty (don't default to "Various")
          slotSchoolId = provider.schoolIds?.[0] || null;
          slotSchoolName = provider.schoolNames?.[0] || null;
          
          // [COUNSELING_SLOT_DEBUG] Log slot school assignment
          console.log("[COUNSELING_SLOT_DEBUG]", {
            providerId: provider.id,
            schoolId: slotSchoolId,
            schoolName: slotSchoolName
          });
        }
      } else if (isCounselorService(normalizedServiceType)) {
        // For virtual tours, keep existing logic unchanged (don't affect virtual tours yet)
        const provider = userMap.get(slot.providerId);
        if (provider) {
          slotSchoolId = provider.schoolIds?.[0] || null;
          slotSchoolName = provider.schoolNames?.[0] || null;
        }
      } else {
        // For non-counselor services (tutoring, test_prep), use query params or null
        slotSchoolId = schoolIdParam || null;
        slotSchoolName = schoolNameParam || null;
      }
      
      return {
        startTimeUTC,
        endTimeUTC,
        providerId: slot.providerId,
        serviceType: originalNormalizedServiceType || null, // Use original service type (test_prep) for response
        schoolId: slotSchoolId,
        schoolName: slotSchoolName,
      };
    });

    // Final output-stage filtering: never return slots that are in the past
    // or within the required minimum lead-time buffer.
    const nowUTC = new Date();
    const cutoffUTC = new Date(nowUTC.getTime() + LEAD_TIME_BUFFER_MINUTES * 60 * 1000);
    const originalSlotsCount = slots.length;
    const filteredSlots = slots.filter((s) => new Date(s.startTimeUTC).getTime() > cutoffUTC.getTime());

    // Temporary debug logging (remove once validated in prod)
    console.log('[SLOT_TIME_FILTER]', {
      nowUTC: nowUTC.toISOString(),
      leadTimeBufferMinutes: LEAD_TIME_BUFFER_MINUTES,
      originalSlotsCount,
      filteredSlotsCount: filteredSlots.length,
      firstRemainingSlot: filteredSlots[0] ?? null,
    });

    if (isCollegeCounselingRequest) {
      console.log('[COUNSELING_SLOTS_GENERATED]', {
        slotsCount: filteredSlots.length,
        exampleSlot: filteredSlots[0],
      });
    }
    
    // [VIRTUAL_TOUR_DEBUG_RESULT] Log after slot generation
    console.log('[VIRTUAL_TOUR_DEBUG_RESULT]', {
      requestedService: normalizedServiceType,
      availabilityServiceUsed: availabilityServiceType,
      slotsCount: filteredSlots.length,
      sample: filteredSlots[0],
    });
    
    // [ALL_SLOTS_RESPONSE_DEBUG] Log response before returning
    console.log('[ALL_SLOTS_RESPONSE_DEBUG]', { slotsCount: filteredSlots.length, sample: filteredSlots[0] });
    
    // [SCHOOL_MATCH_DEBUG] Log final results
    const finalProviderCount = providerIdsToInclude ? providerIdsToInclude.size : Object.keys(availabilityStorage).length;
    console.log(`[SCHOOL_MATCH_DEBUG] Final: serviceType=${normalizedServiceType || 'none'}, schoolId=${schoolIdParam || 'none'}, schoolName=${schoolNameParam || 'none'}, providersMatched=${finalProviderCount}, slotsCount=${filteredSlots.length}, whereClause=${schoolFilterClause}`);
    
    // College Counseling: return ordered provider list with school match metadata for UX.
    let providers:
      | Array<{
          providerId: string;
          providerName: string;
          providerSchoolName: string | null;
          matchesRequestedSchool: boolean;
        }>
      | undefined;

    if (normalizedServiceType === 'college_counseling') {
      const requestedSchoolId = schoolIdParam ? String(schoolIdParam).trim() : '';
      const providerIdsWithSlots = Array.from(new Set(filteredSlots.map((s) => s.providerId))).filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      );

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

      const computeProviderSchoolName = (u: any): string | null => {
        const primary =
          typeof u?.school_name === 'string' && String(u.school_name).trim() ? String(u.school_name).trim() : '';
        if (primary) return primary;
        if (Array.isArray(u?.schoolNames) && u.schoolNames.length > 0) {
          const n = String(u.schoolNames[0] || '').trim();
          return n || null;
        }
        const alt = typeof u?.schoolName === 'string' && u.schoolName.trim() ? u.schoolName.trim() : '';
        return alt || null;
      };

      const computeProviderSchoolId = (u: any): string => {
        const primary = typeof u?.school_id === 'string' ? u.school_id.trim() : '';
        if (primary) return primary;
        if (Array.isArray(u?.schoolIds) && u.schoolIds.length > 0) return String(u.schoolIds[0] || '').trim();
        const alt = typeof u?.schoolId === 'string' ? u.schoolId.trim() : '';
        return alt || '';
      };

      providers = providerIdsWithSlots
        .map((providerId) => {
          const u = userMap.get(providerId);
          const providerName = computeProviderName(u);
          const providerSchoolName = computeProviderSchoolName(u);
          const providerSchoolId = computeProviderSchoolId(u);
          const matchesRequestedSchool = !!requestedSchoolId && !!providerSchoolId && providerSchoolId === requestedSchoolId;
          return { providerId, providerName, providerSchoolName, matchesRequestedSchool };
        })
        .sort((a, b) => {
          if (requestedSchoolId) {
            if (a.matchesRequestedSchool !== b.matchesRequestedSchool) return a.matchesRequestedSchool ? -1 : 1;
          }
          return a.providerName.localeCompare(b.providerName);
        });
    }

    return NextResponse.json({ 
      slots: filteredSlots,
      ...(providers ? { providers } : {}),
      meta: {
        providersMatched: finalProviderCount,
        availabilityRowCount,
        serviceTypeFinal: originalNormalizedServiceType || null, // Use original service type (test_prep) for response
        availabilityServiceUsed: availabilityServiceType || null,
        schoolId: schoolIdParam || null,
        date: dateKey,
      },
    });
  } catch (error) {
    console.error('[API /api/availability/all-slots] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available slots', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
