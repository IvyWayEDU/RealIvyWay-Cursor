'use server';

import { SessionReview } from '@/lib/reviewStore';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Read reviews from file
export async function getReviews(): Promise<SessionReview[]> {
  await ensureDataDir();
  
  if (!existsSync(REVIEWS_FILE)) {
    return [];
  }
  
  try {
    const data = await readFile(REVIEWS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading reviews file:', error);
    return [];
  }
}

// Get reviews by provider ID (GLOBAL - all reviews for provider, not service-specific)
export async function getReviewsByProviderId(providerId: string): Promise<SessionReview[]> {
  const reviews = await getReviews();
  return reviews.filter(review => review.providerId === providerId);
}



