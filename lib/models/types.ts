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
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
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
  gradeLevels?: string[];
  
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
 */
export type SessionStatus = 
  | 'available'     // Session is available for booking (development only)
  | 'pending'       // Session is pending payment/confirmation
  | 'paid'          // Session payment confirmed (student sees as Confirmed, provider sees as Upcoming)
  | 'scheduled'      // Session is confirmed and scheduled
  | 'completed'     // Session has been completed
  | 'cancelled'     // Session was cancelled
  | 'no-show'       // Student or provider didn't show up
  | 'refunded';     // Session was refunded (after cancellation)

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
  
  // Service Information
  serviceTypeId: string; // The type of service being provided
  sessionType: 'tutoring' | 'counseling' | 'test-prep'; // Type of session
  subject?: string; // Subject (if applicable, e.g., "Math", "SAT Reading")
  gradeLevel?: string; // Grade level (if applicable)
  
  // Time Information
  scheduledStartTime: string; // ISO 8601 datetime string
  scheduledEndTime: string; // ISO 8601 datetime string
  actualStartTime?: string; // When the session actually started (if completed)
  actualEndTime?: string; // When the session actually ended (if completed)
  
  // Session Status
  status: SessionStatus;
  
  // Pricing & Payment
  priceCents: number; // Price at time of booking (in cents)
  amountChargedCents: number; // Amount actually charged (may differ due to cancellation)
  amountRefundedCents: number; // Amount refunded (if any)
  
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
  
  // Availability Reference
  availabilityId: string; // The availability slot this session was booked from
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

