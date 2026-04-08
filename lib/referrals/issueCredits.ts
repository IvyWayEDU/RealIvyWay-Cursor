'use server';

/**
 * Issue Referral Credits
 * 
 * Issues referral credits when a referred user completes their first paid session.
 * - Referrer gets $10 (1000 cents)
 * - Referred user gets $10 (1000 cents)
 */

import { getUserById } from '@/lib/auth/storage';
import { getSessionsByStudentId } from '@/lib/sessions/storage';
import { issueReferralCredit } from './actions';
import { markReferralCreditCompleted } from './storage';
import { createNotification } from '@/lib/notifications/storage';

const REFERRER_CREDIT_CENTS = 1000; // $10
const REFERRED_USER_CREDIT_CENTS = 1000; // $10

/**
 * Check if this is the user's first paid session
 */
async function isFirstPaidSession(studentId: string): Promise<boolean> {
  const sessions = await getSessionsByStudentId(studentId);
  // Check for 'upcoming' status (new standard) or 'paid' (legacy for backward compatibility)
  const paidSessions = sessions.filter(session => session.status === 'upcoming' || session.status === 'paid');
  return paidSessions.length === 1; // This is the first one
}

/**
 * Issue referral credits when a user completes their first paid session
 * Returns true if credits were issued, false otherwise
 */
export async function issueReferralCreditsForFirstPaidSession(
  studentId: string
): Promise<{ creditsIssued: boolean; referrerCredited?: boolean; referredUserCredited?: boolean }> {
  // Get the user
  const user = await getUserById(studentId);
  if (!user || !user.referredByUserId) {
    // User doesn't exist or wasn't referred
    return { creditsIssued: false };
  }

  // Check if this is the first paid session
  const isFirst = await isFirstPaidSession(studentId);
  if (!isFirst) {
    // Not the first paid session, credits already issued
    return { creditsIssued: false };
  }

  // Get the referrer
  const referrer = await getUserById(user.referredByUserId);
  if (!referrer) {
    // Referrer doesn't exist
    return { creditsIssued: false };
  }

  let referrerCredited = false;
  let referredUserCredited = false;

  try {
    // Issue credit to referrer ($10)
    const referral = await issueReferralCredit(referrer.id, REFERRER_CREDIT_CENTS, {
      referredUserId: studentId,
    });
    await markReferralCreditCompleted(referral.id);

    // Create notification for referrer
    await createNotification(
      referrer.id,
      'You earned $10 in referral credits!',
      'success'
    );

    referrerCredited = true;
  } catch (error) {
    console.error('Error issuing referrer credit:', error);
  }

  try {
    // Issue credit to referred user ($10)
    const referral = await issueReferralCredit(studentId, REFERRED_USER_CREDIT_CENTS, {
      referredUserId: studentId,
    });
    await markReferralCreditCompleted(referral.id);

    // Create notification for referred user
    await createNotification(
      studentId,
      'You received $10 in referral credits!',
      'success'
    );

    referredUserCredited = true;
  } catch (error) {
    console.error('Error issuing referred user credit:', error);
  }

  return {
    creditsIssued: referrerCredited || referredUserCredited,
    referrerCredited,
    referredUserCredited,
  };
}

