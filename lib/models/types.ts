/**
 * Core data models for IvyWay platform
 * 
 * These models define the structure of user data, student profiles,
 * and provider profiles. They are used throughout the application
 * for type safety and data consistency.
 */

import { UserRole } from '@/lib/auth/types';

/**
 * Base User model
 * Represents the core authentication and identity information
 */
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  roles: UserRole[];
  /**
   * Admin-controlled account status.
   * Defaults to 'active' when absent in dev JSON.
   */
  status?: 'active' | 'suspended';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;

  // Provider-specific fields used by availability filtering (optional for backwards compatibility)
  /**
   * Single source of truth for provider school matching + display.
   * Availability filtering MUST use `school_id` (exact match).
   */
  school_id?: string;
  school_name?: string;
  schoolIds?: string[];
  schoolNames?: string[];
  schools?: string[]; // legacy field

  // Legacy provider role booleans (some availability codepaths still check these)
  isTutor?: boolean;
  isCounselor?: boolean;

  // Provider onboarding fields (optional; stored in dev JSON)
  profilePhotoUrl?: string | null;
  profilePhotoSkipped?: boolean;

  // Provider rating (optional; used for UI badges)
  ratingAverage?: number | null;
  reviewCount?: number;

  // Allow additional legacy/provider fields without breaking builds
  [key: string]: any;
}

/**
 * Student Profile model
 * Contains all student-specific information and preferences
 */
export interface StudentProfile {
  id: string;
  userId: string;
  
  // Personal Information
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  
  // Academic Information
  currentGrade?: string;
  targetGrade?: string;
  academicLevel?: 'elementary' | 'middle' | 'high' | 'college' | 'graduate' | 'adult';
  subjectsOfInterest?: string[];
  learningGoals?: string[];
  
  // Location & Preferences
  timezone?: string;
  preferredLanguage?: string;
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  
  // Parent/Guardian Information (for minors)
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  
  // Profile Status
  profileComplete: boolean;
  onboardingCompleted: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Provider Profile model
 * Contains all provider-specific information (tutors, counselors, institutions)
 */
export interface ProviderProfile {
  id: string;
  userId: string;
  /**
   * Provider-level testing flag.
   * When true, allows certain dev/staging-only testing tools to be enabled in production
   * for this provider account ONLY (e.g. test completion overrides).
   */
  is_test_account?: boolean;
  
  // Provider Type
  providerType: 'tutor' | 'counselor' | 'institution';
  
  // Personal/Organization Information
  displayName: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  
  // Contact Information
  phoneNumber?: string;
  website?: string;
  location?: string;
  timezone?: string;
  
  // Professional Information
  qualifications?: string[];
  certifications?: string[];
  yearsOfExperience?: number;
  specialties?: string[];
  subjects?: string[];
  /**
   * Languages taught when `subjects` includes "languages".
   * Stored as strings for flexibility (preset list + custom).
   */
  languages?: string[];
  gradeLevels?: string[];

  // Ratings / Reviews (optional)
  ratingAverage?: number | null;
  reviewCount?: number;
  
  // Availability
  availabilityStatus: 'available' | 'limited' | 'unavailable';
  workingHours?: {
    day: string;
    startTime: string;
    endTime: string;
  }[];
  
  // Institution-specific fields
  institutionType?: 'school' | 'tutoring-center' | 'online-platform' | 'other';
  accreditation?: string[];
  studentCapacity?: number;
  
  // Profile Status
  profileComplete: boolean;
  verified: boolean;
  active: boolean;

  /**
   * Stripe Connect account ID for payouts.
   * Nullable/optional for backwards compatibility with dev JSON storage.
   *
   * Example: "acct_1234..."
   */
  stripeConnectAccountId?: string | null;

  /**
   * Manual payout details (non-Stripe).
   * Used by admins to send provider withdrawals manually.
   */
  payoutMethod?: string;
  wiseEmail?: string;
  paypalEmail?: string;
  zelleContact?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankCountry?: string;
  accountHolderName?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended User with Profile
 * Combines User with their associated profile based on role
 */
export type UserWithProfile = User & {
  studentProfile?: StudentProfile;
  providerProfile?: ProviderProfile;
};

/**
 * Service Type model
 * Defines the types of services that providers can offer
 * Each service type has pricing, duration, and provider requirements
 */
export interface ServiceType {
  id: string;
  providerId: string; // The provider (tutor/counselor) offering this service
  
  // Service Classification
  serviceCategory: 'tutoring' | 'test-prep' | 'college-counseling';
  name: string; // e.g., "SAT Math Tutoring", "College Application Review"
  description?: string;
  
  // Service Details
  durationMinutes: number; // Duration in minutes (30, 60, 90, etc.)
  priceCents: number; // Price in cents (e.g., 6900 = $69.00)
  
  // Provider Requirements
  requiredProviderRoles: UserRole[]; // Which roles can offer this service
  // e.g., ['tutor'] for tutoring, ['counselor'] for counseling
  
  // Service Configuration
  requiresSubject?: boolean; // Whether a subject must be specified
  subjects?: string[]; // Available subjects for this service (if applicable)
  requiresGradeLevel?: boolean; // Whether grade level must be specified
  gradeLevels?: string[]; // Available grade levels (if applicable)
  
  // Status
  active: boolean; // Whether this service type is currently available
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Availability model
 * Defines when a provider is available for booking sessions
 * Providers create availability slots that students can book
 */
export interface Availability {
  id: string;
  providerId: string; // The provider offering this availability
  
  // Time Information
  startTime: string; // ISO 8601 datetime string
  endTime: string; // ISO 8601 datetime string
  
  // Service Type
  serviceTypeId: string; // Which service type this availability is for
  
  // Availability Status
  status: 'available' | 'booked' | 'cancelled' | 'expired';
  
  // Booking Constraints
  isRecurring: boolean; // Whether this is part of a recurring availability pattern
  recurringPatternId?: string; // ID of the recurring pattern (if applicable)
  
  // Notes
  notes?: string; // Provider notes about this availability slot
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Session Status
 * Represents the current state of a booking session
 * 
 * Note: 'pending' status has been removed. Sessions are automatically confirmed
 * at booking time and use 'scheduled' status instead.
 */
export type SessionStatus = 
  | 'available'     // Session is available for booking (development only)
  | 'paid'          // Session payment confirmed (legacy status, use 'scheduled' for new bookings)
  | 'confirmed'     // Paid booking (canonical). Upcoming/Completed are derived by endTime vs now()
  | 'upcoming'      // Legacy/derived label used throughout UI and availability blocking logic
  | 'scheduled'     // Session is confirmed and scheduled (automatically set at booking time)
  | 'in_progress'   // Session is currently in progress
  | 'in_progress_pending_join' // Session started, waiting for both parties to join
  | 'flagged'       // Provider did not join within 10 minutes of scheduled start (canonical)
  | 'completed'     // Session has been completed
  | 'completed_provider_show' // Completed variant where provider showed (provider earns)
  | 'completed_no_show_provider' // DEV/admin override: completed with provider no-show outcome
  | 'completed_no_show_student' // DEV/admin override: completed with student no-show outcome
  | 'requires_review' // Session completed but requires admin review
  | 'cancelled'     // Session was cancelled (24+ hours before start time)
  | 'cancelled-late' // Session was cancelled within 24 hours of start time (full charge applies)
  | 'no-show'       // Student or provider didn't show up (legacy)
  | 'no_show_student' // Student did not show up
  | 'no_show_provider' // Provider did not show up
  | 'no_show_both'  // Neither student nor provider joined within the grace window (explicit)
  | 'student_no_show' // Alias/legacy variant used in some UI flows
  | 'provider_no_show' // Alias/legacy variant used in some UI flows
  | 'expired_provider_no_show' // Session expired and provider is considered no-show
  | 'refunded';     // Session was refunded (after cancellation)

/**
 * Session completion reason
 * Stored on the session record to make completion + payout decisions auditable and idempotent.
 */
export type SessionCompletionReason =
  | 'PROVIDER_JOINED_WITHIN_10'
  | 'BOTH_JOINED_COMPLETED_AT_END'
  | 'NO_SHOW_PROVIDER'
  | 'NO_SHOW_BOTH'
  | string;

/**
 * Cancellation Reason
 * Tracks why a session was cancelled
 */
export type CancellationReason = 
  | 'student-request'    // Student requested cancellation
  | 'provider-request'   // Provider requested cancellation
  | 'admin-request'      // Admin cancelled
  | 'system-error'       // System/technical issue
  | 'other';             // Other reason

/**
 * Session model
 * Represents a booked session between a student and provider
 * This is the core booking entity that tracks appointments
 */
export interface Session {
  id: string;
  
  // Participants
  studentId: string; // The student who booked the session
  providerId: string; // The provider offering the session

  // Embedded participant snapshots (required for newly-created paid sessions; optional for legacy records)
  studentName?: string;
  studentProfileImage?: string | null;
  providerName?: string;
  providerProfileImage?: string | null;
  
  // Service Information
  serviceTypeId: string; // The type of service being provided
  sessionType: 'tutoring' | 'counseling' | 'test-prep'; // Type of session
  subject?: string; // Subject (if applicable, e.g., "Math", "SAT Reading")
  gradeLevel?: string; // Grade level (if applicable)

  // Canonical booking-flow fields (required for newly-created paid sessions)
  serviceType?: 'tutoring' | 'college_counseling' | 'virtual_tour' | 'test_prep' | string;
  school?: string | { displayName?: string; name?: string; schoolName?: string; label?: string } | null;
  stripePaymentIntentId?: string;

  /**
   * PRICING SOURCE-OF-TRUTH FIELDS (immutable once booked)
   * All money values MUST be integer cents.
   *
   * Note: existing code uses camelCase `priceCents`/`amountChargedCents`.
   * We keep those for backwards compatibility while migrating.
   */
  service_type?: 'tutoring' | 'counseling' | 'test_prep' | 'virtual_tour' | 'ivyway_ai' | string;
  plan?: 'single' | 'monthly' | 'yearly' | string | null;
  // Counseling is 60 minutes only (no 30-minute counseling sessions).
  duration_minutes?: 60 | null;
  session_price_cents?: number;
  /**
   * Stripe Tax amount (integer cents) allocated to this session record.
   * For bundle purchases (e.g., monthly packages), the Checkout tax amount is allocated
   * evenly across created sessions with remainder distributed by index.
   */
  tax_amount_cents?: number;
  /**
   * Total amount charged to the customer for this session allocation (integer cents):
   * total_charge_cents = session_price_cents + tax_amount_cents
   */
  total_charge_cents?: number;
  provider_payout_cents?: number;
  /**
   * Canonical provider payout stored on the session (USD dollars).
   * Flat per-session earnings derived from `getProviderPayout(serviceType)`.
   *
   * NOTE: This is the new platform-wide field requested for payout snapshots.
   */
  providerPayout?: number;
  ivyway_take_cents?: number;
  stripe_fee_cents?: number; // reporting only; NEVER deducted from provider payout
  stripe_price_id?: string;
  
  // Time Information
  scheduledStartTime: string; // ISO 8601 datetime string
  scheduledEndTime: string; // ISO 8601 datetime string
  // Normalized/legacy-friendly aliases (some parts of the app expect these)
  scheduledStart?: string; // ISO 8601 datetime string
  scheduledEnd?: string; // ISO 8601 datetime string
  // Additional aliases seen in older session records (keep optional for backwards compatibility)
  startTime?: string; // ISO 8601 datetime string
  endTime?: string; // ISO 8601 datetime string
  // Legacy date+time variants (used by some older clients/dev seeds)
  date?: string; // YYYY-MM-DD
  start?: string; // HH:MM (or other time string)
  end?: string; // HH:MM (or other time string)
  actualStartTime?: string; // When the session actually started (if completed)
  actualEndTime?: string; // When the session actually ended (if completed)
  
  // Session Status
  status: SessionStatus;

  /**
   * Attendance / payout resolution (canonical)
   *
   * Stored as ISO timestamps (string) in JSON storage.
   * These are set on Zoom join click (best-effort) and used by the session resolver
   * to determine attendance flags and payout eligibility once the session completes.
   */
  providerJoinedAt?: string | null;
  studentJoinedAt?: string | null;
  attendanceFlag?: 'none' | 'provider_no_show' | 'full_no_show';
  providerEligibleForPayout?: boolean;
  /**
   * Canonical payout decision used by earnings calculation.
   * If false, provider payout MUST be 0 and dashboards should show "Earnings withheld".
   *
   * Note: For legacy sessions, this may be absent; use `providerEligibleForPayout` as a fallback.
   */
  providerEarned?: boolean;
  /**
   * Canonical provider no-show marker for dashboards/admin tooling.
   * Set when provider attendance fails validation at completion time.
   */
  flagNoShowProvider?: boolean;
  /**
   * Canonical student no-show marker for dashboards/admin tooling.
   * Used by dev/admin overrides and future student attendance workflows.
   */
  flagNoShowStudent?: boolean;
  /**
   * Best-effort stored Zoom join logs (append-only) to support attendance audits.
   * Used by session finalization to compute join counts.
   */
  zoomJoinLogs?: Array<{
    role: 'provider' | 'student';
    joinedAt: string; // ISO
    source?: 'zoom_webhook' | 'ui_click' | 'unknown';
  }>;
  
  // Pricing & Payment
  priceCents: number; // Price at time of booking (in cents)
  amountChargedCents: number; // Amount actually charged (may differ due to cancellation)
  amountRefundedCents: number; // Amount refunded (if any)
  isPaid?: boolean; // Normalized payment flag used by dashboards/webhook
  paidAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  /**
   * Admin-only testing override: indicates the session was force-completed manually for testing.
   * This must NOT change the canonical time-based auto-completion behavior.
   */
  completed_by_admin_test?: boolean;
  /**
   * Provider-side testing override: indicates the provider manually marked the session as completed
   * for testing payout/earnings flows.
   * This must NOT change the canonical time-based auto-completion behavior.
   */
  completed_by_test_override?: boolean;
  
  // Cancellation Information
  cancelledAt?: string; // When the session was cancelled
  cancelledBy?: string; // User ID who cancelled
  cancellationReason?: CancellationReason;
  cancellationNote?: string; // Additional notes about cancellation
  
  // No-Show Information
  markedNoShowAt?: string; // When the no-show was recorded
  markedNoShowBy?: string; // User ID who marked as no-show
  noShowParty?: 'student' | 'provider' | 'both'; // Who didn't show up
  
  // Booking Metadata
  bookedAt: string; // When the session was originally booked
  bookedBy: string; // User ID who made the booking (usually student)
  
  // Session Notes
  studentNotes?: string; // Notes from the student
  providerNotes?: string; // Notes from the provider
  adminNotes?: string; // Notes from admin (if any)
  topic?: string | null; // Topic (nullable; persisted from booking metadata)
  
  // Availability Reference
  availabilityId: string; // The availability slot this session was booked from
  
  // Zoom Meeting Information
  zoom_join_url?: string; // Zoom meeting join URL for participants (DB-aligned snake_case)
  zoomMeetingId?: string; // Zoom meeting ID
  zoomStartUrl?: string; // Zoom meeting host/start URL (providers)
  zoomStatus?: 'created' | 'failed' | string; // Zoom meeting creation status for this session
  zoomHostEmail?: string;
  confirmationEmailsSent?: boolean;
  payoutStatus?: string;
  /**
   * True once provider earnings have been credited for this session completion.
   * Prevents double-crediting if completion is retried.
   */
  earningsCredited?: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;

  /**
   * Legacy/experimental fields used across different session lifecycle systems.
   * The codebase contains multiple storage/resolution implementations that attach
   * additional properties (attendance tracking, payouts, etc).
   *
   * Keeping this index signature prevents build-breaking type drift while we
   * gradually consolidate the session model.
   */
  [key: string]: any;
}

/**
 * System-wide Audit Log entry (append-only).
 * Backed by local JSONL storage under /data in this codebase.
 */
export interface AuditLog {
  id: string;
  userId: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Referral Credits
 * Stored in Supabase (`referral_credits`).
 */
export type ReferralCreditStatus = 'pending' | 'completed';

export interface ReferralCredit {
  id: string;
  userId: string;
  referredUserId: string | null;
  amountCents: number;
  status: ReferralCreditStatus;
  createdAt: string;
  updatedAt?: string | null;
}

