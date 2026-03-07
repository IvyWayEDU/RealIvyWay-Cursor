'use server';

/**
 * Referral Credit Actions
 * 
 * Server actions for managing referral credits
 */

import { 
  getReferralCreditsByUserId, 
  getActiveReferralCredits,
  createReferralCredit,
  updateExistingCreditsTo31Days,
} from './storage';
import { REFERRAL_CREDIT_EXPIRATION_DAYS } from './constants';
import { ReferralCredit } from '@/lib/models/types';

/**
 * Get all referral credits for the current user
 */
export async function getUserReferralCredits(userId: string): Promise<ReferralCredit[]> {
  return await getReferralCreditsByUserId(userId);
}

/**
 * Get active referral credits for the current user
 */
export async function getUserActiveReferralCredits(userId: string): Promise<ReferralCredit[]> {
  return await getActiveReferralCredits(userId);
}

/**
 * Issue a new referral credit to a user
 */
export async function issueReferralCredit(
  userId: string,
  amountCents: number,
  options?: {
    referralCode?: string;
    referredByUserId?: string;
  }
): Promise<ReferralCredit> {
  return await createReferralCredit(userId, amountCents, options);
}

/**
 * Migrate existing credits to 31-day expiration
 */
export async function migrateCreditsTo31Days(): Promise<number> {
  return await updateExistingCreditsTo31Days();
}

/**
 * Get referral credit expiration days constant
 */
export async function getReferralCreditExpirationDays(): Promise<number> {
  return REFERRAL_CREDIT_EXPIRATION_DAYS;
}

