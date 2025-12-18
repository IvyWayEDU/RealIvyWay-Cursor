'use server';
console.log("STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY);

import { Session } from '@/lib/models/types';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/auth/storage';
import { addDevSession, getDevPendingSessionsByStudentId, getDevPendingSessionsByProviderId, updateDevSession } from '@/lib/devSessionStore';
import crypto from 'crypto';
import Stripe from 'stripe';

export interface CreatePendingSessionResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

/**
 * Session with student information for provider view
 */
export interface SessionWithStudent extends Session {
  studentName?: string;
  studentEmail?: string;
}

/**
 * Create a pending session when a student clicks an available time slot
 */
export async function createPendingSession(
  providerId: string,
  date: string, // ISO date string (YYYY-MM-DD)
  time: string, // Time string (HH:MM)
  sessionType: 'tutoring' | 'counseling' | 'test-prep',
  subject?: string
): Promise<CreatePendingSessionResult> {
  // Get current user session
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in to book a session' };
  }

  // Verify user is a student
  if (!session.roles.includes('student')) {
    return { success: false, error: 'Only students can book sessions' };
  }

  // Validate providerId - MUST be present and not empty
  if (!providerId || providerId.trim() === '' || providerId === 'undefined' || providerId === 'null') {
    return { success: false, error: 'Provider unavailable. Please choose another time.' };
  }

  // Verify provider exists (optional check, but helps ensure data integrity)
  const provider = await getUserById(providerId);
  if (!provider) {
    // Provider doesn't exist, but we'll still allow it in case of mock data
    // Just log a warning
    console.warn(`Warning: Provider with id ${providerId} not found in user database`);
  }

  const studentId = session.userId;

  // Parse date and time to create ISO datetime strings
  const dateTime = new Date(`${date}T${time}`);
  const startTime = dateTime.toISOString();
  const endTime = new Date(dateTime.getTime() + 60 * 60 * 1000).toISOString(); // Default 1 hour

  // Create the session
  const newSession: Session = {
    id: crypto.randomUUID(),
    studentId,
    providerId,
    serviceTypeId: 'pending', // Placeholder until service types are implemented
    sessionType,
    subject,
    scheduledStartTime: startTime,
    scheduledEndTime: endTime,
    status: 'pending',
    priceCents: 0, // No payment yet
    amountChargedCents: 0,
    amountRefundedCents: 0,
    bookedAt: new Date().toISOString(),
    bookedBy: studentId,
    availabilityId: 'pending', // Placeholder until availability system is implemented
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // Add to dev session store (temporary development-only solution)
    addDevSession(newSession);
    return { success: true, sessionId: newSession.id };
  } catch (error) {
    console.error('Error creating pending session:', error);
    return { success: false, error: 'Failed to create session. Please try again.' };
  }
}

/**
 * Get pending sessions for the current student
 */
export async function getStudentPendingSessions(): Promise<Session[]> {
  const session = await getSession();
  if (!session) {
    return [];
  }

  if (!session.roles.includes('student')) {
    return [];
  }

  // Read from dev session store (temporary development-only solution)
  return getDevPendingSessionsByStudentId(session.userId);
}

/**
 * Get pending sessions for the current provider
 * Returns sessions where providerId matches the authenticated provider and status is "pending"
 * Includes student information for display
 * 
 * Uses devSessionStore as the single source of truth (temporary development-only solution)
 * Filters by: providerId === current authenticated user id AND status === 'pending'
 * 
 * IMPORTANT: Uses session.userId from auth/session - no hardcoded provider IDs
 * This ensures both student and provider dashboards read from the same temporary session store.
 */
export async function getProviderPendingSessions(): Promise<SessionWithStudent[]> {
  const session = await getSession();
  if (!session) {
    return [];
  }

  // Check if user has provider role (tutor or counselor)
  const hasProviderRole = session.roles.some(role => role === 'tutor' || role === 'counselor');
  if (!hasProviderRole) {
    return [];
  }

  // Get the authenticated provider's user ID from the session
  // This ensures we only show sessions for the logged-in provider
  const providerUserId = session.userId;
  
  if (!providerUserId) {
    console.warn('Provider session missing userId');
    return [];
  }

  // Read from dev session store (temporary development-only solution)
  const pendingSessions = getDevPendingSessionsByProviderId(providerUserId);
  
  // Enrich sessions with student information
  const sessionsWithStudent: SessionWithStudent[] = await Promise.all(
    pendingSessions.map(async (s) => {
      const student = await getUserById(s.studentId);
      return {
        ...s,
        studentName: student?.name,
        studentEmail: student?.email,
      };
    })
  );
  
  return sessionsWithStudent;
}

/**
 * Get the current authenticated user ID
 * Used by client components to get the user ID for localStorage operations
 */
export async function getCurrentUserId(): Promise<{ userId: string | null; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { userId: null, error: 'You must be logged in' };
  }
  return { userId: session.userId };
}

/**
 * Get the current authenticated user ID if they are a provider (tutor or counselor)
 * Used by AutoSeedSessionsClient to seed sessions only for providers
 */
export async function getCurrentProviderId(): Promise<{ providerId: string | null; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { providerId: null, error: 'You must be logged in' };
  }
  
  // Check if user has provider role (tutor or counselor)
  const hasProviderRole = session.roles.some(role => role === 'tutor' || role === 'counselor');
  if (!hasProviderRole) {
    return { providerId: null, error: 'User is not a provider' };
  }
  
  return { providerId: session.userId };
}

/**
 * Create a Stripe Checkout session for a pending session
 * @param sessionId - The session ID to create checkout for
 * @param priceCents - The price in cents (passed from client since dev store is client-side only)
 * @param sessionType - The type of session (for display purposes)
 */
export async function createCheckoutSession(
  sessionId: string,
  priceCents: number,
  sessionType: 'tutoring' | 'counseling' | 'test-prep'
): Promise<{ 
  success: boolean; 
  checkoutUrl?: string; 
  error?: string 
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in' };
  }

  if (!session.roles.includes('student')) {
    return { success: false, error: 'Only students can pay for sessions' };
  }

  // Initialize Stripe
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Determine session name based on type
    const sessionName = sessionType === 'tutoring' 
      ? 'Tutoring Session' 
      : sessionType === 'counseling' 
      ? 'Counseling Session' 
      : 'Test Prep Session';
    
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: sessionName,
              description: 'Session booking payment',
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/dashboard/student/payment-success?session_id=${sessionId}`,
      cancel_url: `${baseUrl}/dashboard/student?canceled=true`,
      metadata: {
        sessionId,
        studentId: session.userId,
      },
      customer_email: session.email,
    });

    return { 
      success: true, 
      checkoutUrl: checkoutSession.url || undefined 
    };
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    };
  }
}

/**
 * Update session status to paid after successful payment
 * This is called from the payment success page (client-side)
 */
export async function confirmSessionPayment(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in' };
  }

  if (!session.roles.includes('student')) {
    return { success: false, error: 'Only students can confirm payment' };
  }

  // In production, this would update the database
  // For dev mode, this is a no-op since the client will update localStorage
  // We return success so the client can proceed with the update
  return { success: true };
}

