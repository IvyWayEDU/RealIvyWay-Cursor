'use server';

import { revalidatePath } from 'next/cache';

/**
 * DEV-ONLY helper.
 *
 * Earnings are derived from sessions, so there is nothing to clear.
 * This exists only to trigger a UI refresh / cache revalidation in dev flows.
 */
export async function clearEarningsDev(_providerId: string) {
  if (process.env.NODE_ENV === 'production') return;

  // Force any server components/pages that rely on derived earnings to refresh.
  revalidatePath('/dashboard/earnings');
  revalidatePath('/dashboard/earnings/withdraw');
}



