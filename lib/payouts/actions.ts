'use server';

import { getSession } from '@/lib/auth/session';
import { getSessionById, updateSession } from '@/lib/sessions/storage';
import { Session } from '@/lib/models/types';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';

/**
 * DEV-ONLY: Check if provider has zero completed sessions
 */
async function hasZeroCompletedSessions(providerId: string): Promise<boolean> {
  const { getSessionsByProviderId } = await import('@/lib/sessions/storage');
  const sessions = await getSessionsByProviderId(providerId);
  const completedSessions = sessions.filter((s: any) => {
    if (s.status !== 'completed') return false;
    // Do NOT require providerEligibleForPayout to be present/true; many sessions omit it.
    // Only exclude when explicitly withheld/ineligible.
    if (s.providerEarned === false || s.providerEligibleForPayout === false) return false;
    return true;
  });
  return completedSessions.length === 0;
}

/**
 * Admin-only action: Approve payout for a booking
 * Transitions payoutStatus from "pending_payout" to "approved"
 * 
 * @param bookingId - The booking ID to approve
 * @returns Success status or error
 */
export async function approvePayout(bookingId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // Verify user session
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if user is admin
  if (!session.roles.includes('admin')) {
    return { success: false, error: 'Unauthorized: Only admins can approve payouts' };
  }

  // Get the booking
  const booking = await getSessionById(bookingId);
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  // Safety check: Payout must be in pending_payout status
  if (booking.payoutStatus !== 'pending_payout') {
    return { 
      success: false, 
      error: `Cannot approve payout: payoutStatus is "${booking.payoutStatus}", expected "pending_payout".` 
    };
  }

  // Safety check: Session must be completed
  if (booking.status !== 'completed') {
    return { 
      success: false, 
      error: `Cannot approve payout: session status is "${booking.status}", expected "completed".` 
    };
  }

  // Update payout status
  const updateSuccess = await updateSession(bookingId, {
    payoutStatus: 'approved',
  });

  if (!updateSuccess) {
    return { success: false, error: 'Failed to update payout status' };
  }

  console.log('Payout approved:', {
    bookingId,
    providerPayoutCents: booking.providerPayoutCents,
    platformFeeCents: booking.platformFeeCents,
    approvedBy: session.userId,
  });

  return { success: true };
}

/**
 * Admin-only action: Mark payout as paid
 * Transitions payoutStatus from "approved" to "paid"
 * 
 * @param bookingId - The booking ID to mark as paid
 * @returns Success status or error
 */
export async function markPayoutPaid(bookingId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // Verify user session
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Check if user is admin
  if (!session.roles.includes('admin')) {
    return { success: false, error: 'Unauthorized: Only admins can mark payouts as paid' };
  }

  // Get the booking
  const booking = await getSessionById(bookingId);
  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  // Safety check: Payout must be in approved status
  if (booking.payoutStatus !== 'approved') {
    return { 
      success: false, 
      error: `Cannot mark payout as paid: payoutStatus is "${booking.payoutStatus}", expected "approved".` 
    };
  }

  // Safety check: Session must be completed
  if (booking.status !== 'completed') {
    return { 
      success: false, 
      error: `Cannot mark payout as paid: session status is "${booking.status}", expected "completed".` 
    };
  }

  // Update payout status
  const updateSuccess = await updateSession(bookingId, {
    payoutStatus: 'paid',
  });

  if (!updateSuccess) {
    return { success: false, error: 'Failed to update payout status' };
  }

  console.log('Payout marked as paid:', {
    bookingId,
    providerPayoutCents: booking.providerPayoutCents,
    platformFeeCents: booking.platformFeeCents,
    markedPaidBy: session.userId,
  });

  return { success: true };
}

/**
 * Get payout summary for a provider
 * Returns pending earnings, paid out amounts, and available balance
 * Available balance = totalEarnings - sum(pendingWithdrawals) - sum(completedPayouts)
 * 
 * TEMP_ADMIN_MODE: Uses in-memory earnings storage
 * 
 * @param providerId - The provider ID
 * @returns Payout summary
 */
export async function getProviderPayoutSummary(providerId: string): Promise<{
  success: boolean;
  pendingEarningsCents?: number;
  paidOutCents?: number;
  availableBalanceCents?: number;
  error?: string;
}> {
  // Verify user session
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // TEMP_ADMIN_MODE: Check if user is temp admin
  const { isTempAdmin } = await import('@/lib/auth/tempAdmin');
  const isAdmin = session.roles.includes('admin') || isTempAdmin(session.userId);
  const isProvider = session.roles.includes('tutor') || session.roles.includes('counselor');
  const isRequestedProvider = session.userId === providerId;

  if (!isAdmin && !(isProvider && isRequestedProvider)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Earnings are derived dynamically from completed sessions (no credits store).
  const { getSessionsByProviderId } = await import('@/lib/sessions/storage');
  let sessions = await getSessionsByProviderId(providerId);

  const completedSessions = sessions.filter(
    (s: any) =>
      s.status === 'completed' &&
      s.providerId === providerId &&
      s.providerEarned !== false &&
      s.providerEligibleForPayout !== false
  );

  let pendingEarningsCents = 0;
  let paidOutCents = 0;
  let availableEarningsCents = 0; // Only 'available' status counts for withdrawal

  for (const s of completedSessions) {
    const amountCents = calculateProviderPayoutCentsFromSession(s);
    const payoutStatus = (s.payoutStatus || 'available') as string;

    if (payoutStatus === 'paid' || payoutStatus === 'paid_out') {
      paidOutCents += amountCents;
      continue;
    }

    if (payoutStatus === 'available') {
      availableEarningsCents += amountCents;
      pendingEarningsCents += amountCents;
      continue;
    }

    if (payoutStatus === 'pending_payout' || payoutStatus === 'approved') {
      pendingEarningsCents += amountCents;
      continue;
    }
  }

  // Get pending withdrawal requests to calculate available balance
  const { getProviderWithdrawalRequests } = await import('@/lib/payouts/withdrawal-storage');
  const withdrawalRequests = getProviderWithdrawalRequests(providerId);
  const pendingWithdrawals = withdrawalRequests.filter(w => w.status === 'pending');
  const pendingWithdrawalCents = pendingWithdrawals.reduce((sum, w) => sum + w.amountCents, 0);

  // Calculate available balance = only 'available' earnings - pendingWithdrawals
  // This ensures pending withdrawals are immediately reserved from available earnings
  const availableBalanceCents = Math.max(0, availableEarningsCents - pendingWithdrawalCents);

  return {
    success: true,
    pendingEarningsCents,
    paidOutCents,
    availableBalanceCents,
  };
}

/**
 * Get provider bookings with earnings data
 * Returns all bookings for the logged-in provider where payoutStatus is one of: "locked", "pending_payout", "paid_out"
 * 
 * TEMP_ADMIN_MODE: Uses in-memory earnings storage
 * 
 * @param providerId - The provider ID
 * @returns Array of bookings with earnings information
 */
export async function getProviderEarningsBookings(providerId: string): Promise<{
  success: boolean;
  bookings?: Array<{
    id: string;
    providerPayoutCents: number;
    payoutStatus: 'available' | 'locked' | 'pending_payout' | 'approved' | 'paid' | 'paid_out';
    serviceKey?: string;
    serviceLabel: string;
    completedAt?: string;
    bookedAt: string;
    scheduledStartTime: string;
  }>;
  error?: string;
}> {
  // Verify user session
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // TEMP_ADMIN_MODE: Check if user is temp admin
  const { isTempAdmin } = await import('@/lib/auth/tempAdmin');
  const isAdmin = session.roles.includes('admin') || isTempAdmin(session.userId);
  const isProvider = session.roles.includes('tutor') || session.roles.includes('counselor');
  const isRequestedProvider = session.userId === providerId;

  if (!isAdmin && !(isProvider && isRequestedProvider)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Earnings are derived dynamically from completed sessions (no credits store).
  const { getSessionsByProviderId } = await import('@/lib/sessions/storage');
  const sessions = await getSessionsByProviderId(providerId);

  const bookings = sessions
    .filter((s) => s.providerId === providerId && s.status === 'completed')
    .map((s) => ({
      id: s.id,
      providerPayoutCents: calculateProviderPayoutCentsFromSession(s),
      payoutStatus: (s.payoutStatus || 'available') as any,
      serviceLabel: getServiceLabel(s),
      completedAt: s.completedAt,
      bookedAt: s.bookedAt,
      scheduledStartTime: s.scheduledStartTime,
    }))
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.scheduledStartTime).getTime();
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.scheduledStartTime).getTime();
      return dateB - dateA;
    });

  return {
    success: true,
    bookings,
  };
}

/**
 * Helper function to get service label from session
 * Maps sessionType and serviceTypeId to a human-readable service label
 */
function getServiceLabel(session: Session): string {
  const sessionType = session.sessionType || '';
  const serviceTypeId = session.serviceTypeId || '';

  // Map based on sessionType and serviceTypeId
  if (sessionType === 'tutoring' || serviceTypeId === 'tutoring') {
    return 'Tutoring Services';
  } else if (sessionType === 'test-prep' || serviceTypeId === 'test-prep') {
    return 'Test Prep';
  } else if (sessionType === 'counseling' || serviceTypeId === 'counseling') {
    return 'College Counseling';
  } else if (serviceTypeId === 'virtual-tour') {
    return 'Virtual Tours';
  }

  // Fallback to serviceTypeId if available, otherwise sessionType
  return serviceTypeId || sessionType || 'Service';
}

