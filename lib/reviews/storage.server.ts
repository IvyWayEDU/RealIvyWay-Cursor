'use server';

import { SessionReview } from '@/lib/reviewStore';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

// Ensure data directory exists
async function ensureDataDir() {
  if (FS_DISABLED_IN_PROD) return;
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(DATA_DIR, { recursive: true });
  } catch {
    return;
  }
}

// Read reviews from file
export async function getReviews(): Promise<SessionReview[]> {
  if (FS_DISABLED_IN_PROD) return [];
  await ensureDataDir();

  try {
    const fsp = await import('fs/promises');
    const data = await fsp.readFile(REVIEWS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Get reviews by provider ID (GLOBAL - all reviews for provider, not service-specific)
export async function getReviewsByProviderId(providerId: string): Promise<SessionReview[]> {
  const reviews = await getReviews();
  return reviews.filter(review => review.providerId === providerId);
}



