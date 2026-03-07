'use server';

/**
 * Referral Code Validation
 * 
 * Functions for validating referral codes and finding referrers
 */

import { getUsers } from '@/lib/auth/storage';

/**
 * Generate a referral code from a user ID
 * Uses the same logic as ReferralsSection component
 */
function generateReferralCode(userId: string): string {
  // Remove hyphens and take first 8 characters, convert to uppercase
  const cleanId = userId.replace(/-/g, '').substring(0, 8).toUpperCase();
  return cleanId;
}

/**
 * Validate a referral code and return the referrer's user ID if valid
 * @param referralCode The referral code to validate
 * @returns The referrer's user ID if valid, null otherwise
 */
export async function validateReferralCode(referralCode: string): Promise<string | null> {
  if (!referralCode || referralCode.trim().length === 0) {
    return null;
  }

  // Normalize the code (uppercase, trim)
  const normalizedCode = referralCode.trim().toUpperCase();

  // Get all users
  const users = await getUsers();

  // Find the user whose referral code matches
  for (const user of users) {
    const userReferralCode = generateReferralCode(user.id);
    if (userReferralCode === normalizedCode) {
      return user.id;
    }
  }

  return null;
}






