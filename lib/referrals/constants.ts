/**
 * Referral Credit Constants
 * 
 * Constants for referral credit configuration.
 * Separated from storage.ts to comply with Next.js "use server" rules.
 */

// Referral credit expiration: 31 days (in milliseconds)
export const REFERRAL_CREDIT_EXPIRATION_DAYS = 31;
export const REFERRAL_CREDIT_EXPIRATION_MS = REFERRAL_CREDIT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;






