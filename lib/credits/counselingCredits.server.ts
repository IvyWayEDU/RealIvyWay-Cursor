import 'server-only';

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

type CreditBucket = {
  id: string;
  userId: string;
  service_type: 'counseling';
  plan: 'monthly';
  remaining: number;
  totalGranted: number;
  // Stripe linkage (for audit + idempotency)
  stripeSubscriptionId?: string;
  appliedInvoiceIds: string[];
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const CREDITS_FILE = path.join(DATA_DIR, 'counseling-credits.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readBuckets(): CreditBucket[] {
  ensureDataDir();
  if (!existsSync(CREDITS_FILE)) return [];
  try {
    const raw = readFileSync(CREDITS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CreditBucket[]) : [];
  } catch {
    return [];
  }
}

function writeBuckets(buckets: CreditBucket[]) {
  ensureDataDir();
  writeFileSync(CREDITS_FILE, JSON.stringify(buckets, null, 2), 'utf-8');
}

export function getCounselingMonthlyCreditsRemaining(userId: string): number {
  const buckets = readBuckets();
  return buckets
    .filter((b) => b.userId === userId && b.service_type === 'counseling' && b.plan === 'monthly')
    .reduce((sum, b) => sum + Math.max(0, Math.floor(b.remaining || 0)), 0);
}

/**
 * Grants 4 monthly counseling credits (idempotent per Stripe invoice id).
 * Returns the bucket id used/created.
 */
export function grantCounselingMonthlyCredits(params: {
  userId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  creditsToGrant?: number; // default 4
}): { bucketId: string; alreadyApplied: boolean } {
  const now = new Date().toISOString();
  const creditsToGrant = Math.max(0, Math.floor(params.creditsToGrant ?? 4));
  if (!params.userId || !params.stripeSubscriptionId || !params.stripeInvoiceId) {
    throw new Error('Missing required fields for credit grant');
  }
  if (creditsToGrant <= 0) {
    throw new Error('creditsToGrant must be > 0');
  }

  const buckets = readBuckets();
  const existing = buckets.find(
    (b) =>
      b.userId === params.userId &&
      b.service_type === 'counseling' &&
      b.plan === 'monthly' &&
      b.stripeSubscriptionId === params.stripeSubscriptionId
  );

  if (existing) {
    if (existing.appliedInvoiceIds.includes(params.stripeInvoiceId)) {
      return { bucketId: existing.id, alreadyApplied: true };
    }
    existing.remaining = Math.max(0, Math.floor(existing.remaining + creditsToGrant));
    existing.totalGranted = Math.max(0, Math.floor(existing.totalGranted + creditsToGrant));
    existing.appliedInvoiceIds = [...existing.appliedInvoiceIds, params.stripeInvoiceId].slice(-50);
    existing.updatedAt = now;
    writeBuckets(buckets);
    return { bucketId: existing.id, alreadyApplied: false };
  }

  const bucket: CreditBucket = {
    id: crypto.randomUUID(),
    userId: params.userId,
    service_type: 'counseling',
    plan: 'monthly',
    remaining: creditsToGrant,
    totalGranted: creditsToGrant,
    stripeSubscriptionId: params.stripeSubscriptionId,
    appliedInvoiceIds: [params.stripeInvoiceId],
    createdAt: now,
    updatedAt: now,
  };
  buckets.push(bucket);
  writeBuckets(buckets);
  return { bucketId: bucket.id, alreadyApplied: false };
}

/**
 * Consume a single counseling monthly credit. Prefers oldest bucket with remaining > 0.
 */
export function consumeOneCounselingMonthlyCredit(userId: string): { bucketId: string; stripeSubscriptionId?: string } {
  const buckets = readBuckets();
  const candidates = buckets
    .filter((b) => b.userId === userId && b.service_type === 'counseling' && b.plan === 'monthly' && (b.remaining ?? 0) > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const bucket = candidates[0];
  if (!bucket) {
    throw new Error('No counseling monthly credits available');
  }

  bucket.remaining = Math.max(0, Math.floor(bucket.remaining - 1));
  bucket.updatedAt = new Date().toISOString();
  writeBuckets(buckets);
  return { bucketId: bucket.id, stripeSubscriptionId: bucket.stripeSubscriptionId };
}


