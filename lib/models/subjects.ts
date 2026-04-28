/**
 * Canonical subject key system
 * 
 * This module provides a single source of truth for subject normalization.
 * All subject matching uses canonical keys, not display labels.
 * 
 * Canonical keys are lowercase, underscore-separated identifiers (e.g., "english", "math", "science")
 * Display labels can vary (e.g., "English", "English & Language Arts", "English Language")
 * 
 * RULES:
 * 1. Matching uses canonical keys only
 * 2. Display labels are UI-only
 * 3. Case differences NEVER affect matching
 * 4. Variations like "English" vs "English & Language Arts" → same canonical key
 */

/**
 * Canonical subject keys
 * These are the normalized identifiers used for matching
 */
export type CanonicalSubjectKey =
  | 'english'
  | 'math'
  | 'science'
  | 'history'
  | 'languages'
  | 'test_prep'
  | 'other';

/**
 * Mapping from display variations to canonical keys
 * 
 * Multiple display names can map to the same canonical key.
 * Examples:
 * - "English", "english", "English & Language Arts", "English Language" → "english"
 * - "Math", "mathematics", "Maths" → "math"
 */
const SUBJECT_TO_CANONICAL: Record<string, CanonicalSubjectKey> = {
  // English variations
  // Provider onboarding uses: "English"
  // Booking flow uses: "English & Language Arts"
  // Both should map to: "english"
  // Note: All keys use "and" not "&" because normalization replaces & with 'and'
  'english': 'english',
  'english language': 'english',
  'english and language arts': 'english',
  'english language arts': 'english',
  'english literature': 'english',
  'language arts': 'english',
  'language arts and english': 'english',
  'ela': 'english',
  
  // Math variations
  // Provider onboarding: "Math"
  // Booking flow: "Math"
  'math': 'math',
  'mathematics': 'math',
  'maths': 'math',
  
  // Science variations
  // Provider onboarding: "Science"
  // Booking flow: "Science"
  'science': 'science',
  'sciences': 'science',
  
  // History variations
  // Provider onboarding: "History"
  // Booking flow: "History & Social Studies"
  // Both should map to: "history"
  // Note: All keys use "and" not "&" because normalization replaces & with 'and'
  'history': 'history',
  'history and social studies': 'history',
  'social studies': 'history',
  'social studies and history': 'history',
  'social science': 'history',
  
  // Languages variations
  // Provider onboarding: "Languages"
  // Booking flow: "Foreign Languages"
  // Both should map to: "languages"
  'languages': 'languages',
  'foreign languages': 'languages',
  'foreign language': 'languages',
  'language': 'languages',
  
  // Test prep variations
  // Provider onboarding: "Test Prep"
  // Booking flow uses various test prep subjects (SAT, ACT, etc.) - ALL map to "test_prep"
  'test prep': 'test_prep',
  'testprep': 'test_prep',
  'test preparation': 'test_prep',
  'exam prep': 'test_prep',
  'exam preparation': 'test_prep',
  
  // Standardized test variations - ALL map to "test_prep"
  'sat': 'test_prep',
  'sat prep': 'test_prep',
  'sat preparation': 'test_prep',
  'act': 'test_prep',
  'act prep': 'test_prep',
  'act preparation': 'test_prep',
  'psat': 'test_prep',
  'psat prep': 'test_prep',
  'preliminary sat': 'test_prep',
  'ssat': 'test_prep',
  'secondary school admission test': 'test_prep',
  'isee': 'test_prep',
  'independent school entrance exam': 'test_prep',
  'ap exams': 'test_prep',
  'ap exam': 'test_prep',
  'advanced placement': 'test_prep',
  'ib exams': 'test_prep',
  'ib exam': 'test_prep',
  'international baccalaureate': 'test_prep',
  'gre': 'test_prep',
  'graduate record examination': 'test_prep',
  'gmat': 'test_prep',
  'graduate management admission test': 'test_prep',
  'regents exams': 'test_prep',
  'regents exam': 'test_prep',
  'toefl': 'test_prep',
  'test of english as a foreign language': 'test_prep',
  'ielts': 'test_prep',
  'international english language testing system': 'test_prep',
  
  // "Other" for Test Prep should also map to test_prep
  // This allows providers with "Test Prep" to match students who select "Other"
  // However, "other" can also be a general category, so we need to check context
  // For now, map "other" to "other" for general cases, but Test Prep "Other" will be handled
  // by the booking flow passing the subject in the context of test_prep service
  'other': 'other',
};

/**
 * Normalize a subject name to its canonical key
 * 
 * @param subject - Subject display name (e.g., "English", "English & Language Arts", "math")
 * @returns Canonical subject key (e.g., "english", "math") or null if not recognized
 * 
 * Normalization process:
 * 1. Trim whitespace
 * 2. Convert to lowercase
 * 3. Replace "&" with "and" for consistent matching
 * 4. Collapse multiple spaces to single space
 * 5. Look up in mapping
 * 6. Return canonical key or null
 */
export function normalizeSubjectToCanonical(subject: string | null | undefined): CanonicalSubjectKey | null {
  if (!subject) return null;
  
  // Normalize:
  // - trim + lowercase
  // - normalize separators (_,-,/) into spaces
  // - replace "&" with "and"
  // - strip other punctuation
  // - collapse whitespace
  const normalized = subject
    .trim()
    .toLowerCase()
    .replace(/[_/.-]+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Direct lookup in mapping
  // Mapping keys are already normalized (lowercase, use 'and' not '&')
  if (normalized in SUBJECT_TO_CANONICAL) {
    return SUBJECT_TO_CANONICAL[normalized];
  }
  
  // For unrecognized subjects, return null (don't match)
  return null;
}

/**
 * Check if two subjects match using canonical keys
 * 
 * @param subject1 - First subject (display name or canonical key)
 * @param subject2 - Second subject (display name or canonical key)
 * @returns true if subjects match (same canonical key)
 */
export function subjectsMatch(subject1: string | null | undefined, subject2: string | null | undefined): boolean {
  // Both null/undefined = match (no filter)
  if (!subject1 && !subject2) return true;
  
  // One is null/undefined = no match (filter requires subject)
  if (!subject1 || !subject2) return false;
  
  const canonical1 = normalizeSubjectToCanonical(subject1);
  const canonical2 = normalizeSubjectToCanonical(subject2);
  
  // If either doesn't normalize, no match
  if (!canonical1 || !canonical2) return false;
  
  // Match on canonical keys
  return canonical1 === canonical2;
}

/**
 * Get canonical key for a subject (throws if invalid)
 * Use this when you need to ensure a subject is valid
 */
export function getCanonicalSubjectKey(subject: string): CanonicalSubjectKey {
  const canonical = normalizeSubjectToCanonical(subject);
  if (!canonical) {
    throw new Error(`Invalid subject: "${subject}" - not recognized`);
  }
  return canonical;
}

/**
 * Get all canonical subject keys
 */
export function getAllCanonicalSubjects(): CanonicalSubjectKey[] {
  return ['english', 'math', 'science', 'history', 'languages', 'test_prep', 'other'];
}

/**
 * Check if a subject is a valid canonical key or can be normalized
 */
export function isValidSubject(subject: string | null | undefined): boolean {
  if (!subject) return false;
  return normalizeSubjectToCanonical(subject) !== null;
}

/**
 * Normalize subject ID to canonical form (used everywhere for consistency)
 * This is the single canonical normalization function for all subject matching.
 * 
 * Handles all Test Prep variations:
 * - "Test Prep", "test prep", "test_prep", "testprep" → "test_prep"
 * - "SAT", "sat", "SAT Prep", "sat prep" → "test_prep"
 * - "ACT", "act", "ACT Prep", "act prep" → "test_prep"
 * 
 * Also preserves existing canonical values for other subjects.
 * 
 * @param subject - Subject name or ID (any format)
 * @returns Canonical subject ID string or null if not recognized
 */
export function normalizeSubjectId(subject: string | null | undefined): string | null {
  if (!subject) return null;
  
  // Use the existing normalization function which already handles all variations
  const canonical = normalizeSubjectToCanonical(subject);
  
  // Self-check: Warn if subject contains test/sat/act but normalizes to null
  if (canonical === null) {
    const lower = subject.toLowerCase();
    if (lower.includes('test') || lower.includes('sat') || lower.includes('act')) {
      console.warn('[SUBJECT_NORMALIZATION_WARNING] Subject contains test/sat/act but normalized to null:', {
        subject,
        lower,
      });
    }
  }
  
  return canonical;
}

