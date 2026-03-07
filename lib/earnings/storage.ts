/**
 * TEMP_ADMIN_MODE: In-memory earnings storage for local testing
 * 
 * This is a temporary storage solution for local development without Supabase.
 * Earnings are stored in memory (Map) and will be lost on server restart.
 * DO NOT use in production. This will be replaced with database storage.
 */

import { Session } from '@/lib/models/types';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';

/**
 * Earnings entry for a completed session
 */
export interface EarningsEntry {
  id: string; // Same as session ID
  sessionId: string;
  providerId: string;
  amountCents: number; // Provider payout (kept for backward compatibility, same as providerPayoutCents)
  serviceType: string; // Standardized service type: 'tutoring' | 'counseling' | 'test_prep' | 'virtual_tour'
  status: 'available' | 'withdrawn' | 'pending'; // Earnings status
  completedAt: string;
  createdAt: string;
  // New required fields for complete earnings breakdown
  grossAmountCents: number; // Total amount charged (before fees)
  providerPayoutCents: number; // Amount provider receives
  platformFeeCents: number; // Platform fee amount
}

// TEMP_ADMIN_MODE: In-memory storage (Map)
// Key: providerId, Value: Array of earnings entries
const earningsStore = new Map<string, EarningsEntry[]>();

/**
 * TEMP_ADMIN_MODE: Add earnings for a completed session
 */
export function addEarnings(entry: EarningsEntry): void {
  const existing = earningsStore.get(entry.providerId) || [];
  // Check if earnings already exist for this session
  const existingIndex = existing.findIndex(e => e.sessionId === entry.sessionId);
  if (existingIndex >= 0) {
    // Update existing entry
    existing[existingIndex] = entry;
  } else {
    // Add new entry
    existing.push(entry);
  }
  earningsStore.set(entry.providerId, existing);
}

/**
 * TEMP_ADMIN_MODE: Get all earnings for a provider
 */
export function getProviderEarnings(providerId: string): EarningsEntry[] {
  return earningsStore.get(providerId) || [];
}

/**
 * TEMP_ADMIN_MODE: Get total earnings for a provider
 */
export function getProviderTotalEarnings(providerId: string): number {
  const earnings = getProviderEarnings(providerId);
  return earnings.reduce((sum, entry) => sum + entry.amountCents, 0);
}

/**
 * TEMP_ADMIN_MODE: Get earnings entry by session ID
 */
export function getEarningsBySessionId(sessionId: string): EarningsEntry[] {
  const results: EarningsEntry[] = [];
  for (const entries of earningsStore.values()) {
    const entry = entries.find(e => e.sessionId === sessionId);
    if (entry) {
      results.push(entry);
    }
  }
  return results;
}

/**
 * TEMP_ADMIN_MODE: Calculate earnings amount based on service type
 * 
 * Earnings rules:
 * - Provider earnings are a flat per-session payout from `getProviderPayout(serviceType)`
 * - Source of truth is persisted on the session as `providerPayout` (USD dollars)
 * - Legacy sessions fall back to `provider_payout_cents` / `providerPayoutCents`
 */
export function calculateEarningsAmount(session: Session): number {
  // Source of truth: fixed provider payout snapshot (integer cents), derived from getProviderPayout().
  return calculateProviderPayoutCentsFromSession(session);
}



