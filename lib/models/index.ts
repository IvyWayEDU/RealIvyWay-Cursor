/**
 * Booking Models Index
 * 
 * Central export point for all booking-related models and rules
 */

// Core booking models
export type {
  ServiceType,
  Availability,
  Session,
  SessionStatus,
  CancellationReason,
} from './types';

// Ownership and access rules
export {
  ServiceTypeOwnership,
  AvailabilityOwnership,
  SessionOwnership,
  CancellationPolicy,
  NoShowPolicy,
  checkBookingPermission,
} from './booking-rules';

// Re-export existing models for convenience
export type {
  User,
  StudentProfile,
  ProviderProfile,
  UserWithProfile,
} from './types';

