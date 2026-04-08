'use server';

/**
 * Referral Credit Storage
 * 
 * Manages referral credit data storage and retrieval.
 * Uses Supabase/Postgres for storage.
 */

import { ReferralCredit, ReferralCreditStatus } from '@/lib/models/types';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

type ReferralCreditRow = {
  id: string;
  user_id: string;
  referred_user_id: string | null;
  amount_cents: number;
  status: ReferralCreditStatus;
  created_at: string;
  updated_at: string | null;
};

function mapRowToReferralCredit(row: ReferralCreditRow): ReferralCredit {
  return {
    id: row.id,
    userId: row.user_id,
    referredUserId: row.referred_user_id,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Read all referral credits from storage
 */
export async function getReferralCredits(): Promise<ReferralCredit[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('referral_credits')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referral credits: ${error.message}`);
  }

  return (data as ReferralCreditRow[]).map(mapRowToReferralCredit);
}

/**
 * Get referral credits for a specific user
 */
export async function getReferralCreditsByUserId(userId: string): Promise<ReferralCredit[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('referral_credits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referral credits for user ${userId}: ${error.message}`);
  }

  return (data as ReferralCreditRow[]).map(mapRowToReferralCredit);
}

/**
 * Get "active" referral credits for a user (completed only).
 */
export async function getActiveReferralCredits(userId: string): Promise<ReferralCredit[]> {
  const userCredits = await getReferralCreditsByUserId(userId);
  return userCredits.filter((c) => c.status === 'completed');
}

/**
 * Create a new referral credit (pending).
 *
 * Inserts into `referral_credits`:
 * - id
 * - user_id
 * - referred_user_id
 * - amount_cents
 * - status = 'pending'
 */
export async function createReferralCredit(
  userId: string,
  amountCents: number,
  options?: {
    referredUserId?: string | null;
  }
): Promise<ReferralCredit> {
  const supabase = getSupabaseAdmin();

  const id = crypto.randomUUID();
  const insertPayload = {
    id,
    user_id: userId,
    referred_user_id: options?.referredUserId ?? null,
    amount_cents: amountCents,
    status: 'pending' as ReferralCreditStatus,
  };

  const { data, error } = await supabase
    .from('referral_credits')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create referral credit: ${error.message}`);
  }

  const referral = mapRowToReferralCredit(data as ReferralCreditRow);
  console.log("Referral created:", referral);
  return referral;
}

/**
 * Mark a referral credit as completed.
 *
 * update referral_credits set status = 'completed' where id = X
 */
export async function markReferralCreditCompleted(id: string): Promise<ReferralCredit> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('referral_credits')
    .update({ status: 'completed' as ReferralCreditStatus })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to mark referral credit completed (id=${id}): ${error.message}`);
  }

  return mapRowToReferralCredit(data as ReferralCreditRow);
}

/**
 * Legacy migration hook (no-op after Supabase migration).
 */
export async function updateExistingCreditsTo31Days(): Promise<number> {
  return 0;
}

