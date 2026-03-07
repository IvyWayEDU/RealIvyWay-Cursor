/**
 * Platform Fee Types
 * 
 * Defines the structure for platform fees that can be configured
 * per service type and plan type.
 */

/**
 * Service type for platform fees
 */
export type PlatformFeeServiceType = 
  | 'tutoring'
  | 'test-prep'
  | 'college-counseling'
  | 'virtual-tours';

/**
 * Plan type for platform fees
 */
export type PlatformFeePlanType =
  | 'single-session'
  | 'monthly-package'
  | 'counseling-single'
  | 'counseling-monthly'
  | 'single-tour';

/**
 * Fee calculation type
 */
export type FeeCalculationType = 'flat' | 'percentage';

/**
 * Platform Fee Configuration
 * Defines a fee for a specific service + plan combination
 */
export interface PlatformFee {
  id: string;
  serviceType: PlatformFeeServiceType;
  planType: PlatformFeePlanType;
  calculationType: FeeCalculationType; // 'flat' or 'percentage'
  amountCents: number; // Flat amount in cents (if calculationType is 'flat')
  percentage: number; // Percentage (0-100) (if calculationType is 'percentage')
  updatedAt: string; // ISO 8601 datetime string
  updatedBy?: string; // User ID who last updated (admin)
}

/**
 * Platform Fees Configuration
 * Contains all platform fee configurations
 */
export interface PlatformFeesConfig {
  fees: PlatformFee[];
  lastUpdatedAt: string; // ISO 8601 datetime string
  lastUpdatedBy?: string; // User ID who last updated (admin)
}





