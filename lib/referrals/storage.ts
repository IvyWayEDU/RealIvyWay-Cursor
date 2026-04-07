'use server';

/**
 * Referral Credit Storage
 * 
 * Manages referral credit data storage and retrieval.
 * Uses file-based storage for development (similar to other storage modules).
 */

import { ReferralCredit, ReferralCreditStatus } from '@/lib/models/types';
import path from 'path';
import { REFERRAL_CREDIT_EXPIRATION_MS } from './constants';

const STORAGE_FILE = path.join(process.cwd(), 'data', 'referral-credits.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

/**
 * Ensure the data directory exists
 */
async function ensureDataDirectory(): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dataDir = path.dirname(STORAGE_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

/**
 * Read all referral credits from storage
 */
export async function getReferralCredits(): Promise<ReferralCredit[]> {
  if (FS_DISABLED_IN_PROD) return [];
  try {
    await ensureDataDirectory();
    const fsp = await import('fs/promises');
    const data = await fsp.readFile(STORAGE_FILE, 'utf-8');
    const credits: ReferralCredit[] = JSON.parse(data);
    
    // Update status for expired credits and recalculate remaining amounts
    const now = new Date().getTime();
    const updatedCredits = credits.map(credit => {
      const expiresAt = new Date(credit.expiresAt).getTime();
      const isExpired = now > expiresAt;
      
      // If expired and not already marked as expired, update status
      if (isExpired && credit.status !== 'expired' && credit.status !== 'used') {
        return {
          ...credit,
          status: 'expired' as ReferralCreditStatus,
          remainingAmountCents: 0,
          updatedAt: new Date().toISOString(),
        };
      }
      
      // Recalculate remaining amount
      const remaining = Math.max(0, credit.amountCents - credit.usedAmountCents);
      
      // Update status based on usage
      let status = credit.status;
      if (remaining === 0 && credit.amountCents > 0) {
        status = credit.usedAmountCents > 0 ? 'used' : 'expired';
      } else if (remaining > 0 && remaining < credit.amountCents) {
        status = 'partially_used';
      } else if (remaining === credit.amountCents && credit.status !== 'expired') {
        status = 'active';
      }
      
      return {
        ...credit,
        remainingAmountCents: remaining,
        status,
        updatedAt: credit.updatedAt,
      };
    });
    
    // Save updated credits if any changes were made
    const hasChanges = updatedCredits.some((credit, index) => 
      credit.status !== credits[index].status || 
      credit.remainingAmountCents !== credits[index].remainingAmountCents
    );
    
    if (hasChanges) {
      await saveReferralCredits(updatedCredits);
    }
    
    return updatedCredits;
  } catch {
    return [];
  }
}

/**
 * Save referral credits to storage
 */
async function saveReferralCredits(credits: ReferralCredit[]): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  try {
    await ensureDataDirectory();
    const fsp = await import('fs/promises');
    await fsp.writeFile(STORAGE_FILE, JSON.stringify(credits, null, 2), 'utf-8');
  } catch {
    return;
  }
}

/**
 * Get referral credits for a specific user
 */
export async function getReferralCreditsByUserId(userId: string): Promise<ReferralCredit[]> {
  const allCredits = await getReferralCredits();
  return allCredits.filter(credit => credit.userId === userId);
}

/**
 * Get active (non-expired, non-used) referral credits for a user
 */
export async function getActiveReferralCredits(userId: string): Promise<ReferralCredit[]> {
  const userCredits = await getReferralCreditsByUserId(userId);
  const now = new Date().getTime();
  
  return userCredits.filter(credit => {
    const expiresAt = new Date(credit.expiresAt).getTime();
    const isExpired = now > expiresAt;
    const hasRemaining = credit.remainingAmountCents > 0;
    
    return !isExpired && hasRemaining && credit.status !== 'used';
  });
}

/**
 * Create a new referral credit
 * Sets expiration to 31 days from issuance (per new expiration policy)
 */
export async function createReferralCredit(
  userId: string,
  amountCents: number,
  options?: {
    referralCode?: string;
    referredByUserId?: string;
  }
): Promise<ReferralCredit> {
  const now = new Date();
  // All new credits expire 31 days after issuance
  const expiresAt = new Date(now.getTime() + REFERRAL_CREDIT_EXPIRATION_MS);
  
  const credit: ReferralCredit = {
    id: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    amountCents,
    usedAmountCents: 0,
    remainingAmountCents: amountCents,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(), // 31 days from issuance
    status: 'active',
    referralCode: options?.referralCode,
    referredByUserId: options?.referredByUserId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  
  const credits = await getReferralCredits();
  credits.push(credit);
  await saveReferralCredits(credits);
  
  return credit;
}

/**
 * Update existing referral credits to use 31-day expiration
 * Only updates credits that haven't expired yet
 */
export async function updateExistingCreditsTo31Days(): Promise<number> {
  const credits = await getReferralCredits();
  const now = new Date().getTime();
  let updatedCount = 0;
  
  const updatedCredits = credits.map(credit => {
    const expiresAt = new Date(credit.expiresAt).getTime();
    const isExpired = now > expiresAt;
    
    // Only update if not expired and not already using 31-day expiration
    if (!isExpired && credit.status !== 'expired' && credit.status !== 'used') {
      const issuedAt = new Date(credit.issuedAt).getTime();
      const newExpiresAt = new Date(issuedAt + REFERRAL_CREDIT_EXPIRATION_MS);
      
      // Only update if the expiration would change (was set to 90 days)
      const oldExpiresAt = new Date(credit.expiresAt).getTime();
      const daysDifference = (oldExpiresAt - issuedAt) / (24 * 60 * 60 * 1000);
      
      if (Math.abs(daysDifference - 90) < 1) {
        // Was 90 days, update to 31 days
        updatedCount++;
        return {
          ...credit,
          expiresAt: newExpiresAt.toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }
    
    return credit;
  });
  
  if (updatedCount > 0) {
    await saveReferralCredits(updatedCredits);
  }
  
  return updatedCount;
}

/**
 * Use a referral credit (deduct amount)
 */
export async function useReferralCredit(
  creditId: string,
  amountCents: number
): Promise<ReferralCredit | null> {
  const credits = await getReferralCredits();
  const creditIndex = credits.findIndex(c => c.id === creditId);
  
  if (creditIndex === -1) {
    return null;
  }
  
  const credit = credits[creditIndex];
  
  // Check if credit is still valid
  const now = new Date().getTime();
  const expiresAt = new Date(credit.expiresAt).getTime();
  if (now > expiresAt) {
    // Credit expired
    credits[creditIndex] = {
      ...credit,
      status: 'expired',
      remainingAmountCents: 0,
      updatedAt: new Date().toISOString(),
    };
    await saveReferralCredits(credits);
    return credits[creditIndex];
  }
  
  // Check if there's enough remaining
  const available = Math.min(credit.remainingAmountCents, amountCents);
  const newUsedAmount = credit.usedAmountCents + available;
  const newRemaining = credit.amountCents - newUsedAmount;
  
  const updatedCredit: ReferralCredit = {
    ...credit,
    usedAmountCents: newUsedAmount,
    remainingAmountCents: newRemaining,
    status: newRemaining === 0 ? 'used' : 'partially_used',
    usedAt: credit.usedAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  credits[creditIndex] = updatedCredit;
  await saveReferralCredits(credits);
  
  return updatedCredit;
}

