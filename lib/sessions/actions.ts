'use server';
console.log("STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY);

import { Session } from '@/lib/models/types';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/auth/storage';
import { addDevSession, updateDevSession, getDevSessions } from '@/lib/devSessionStore';
import crypto from 'crypto';
import Stripe from 'stripe';

export interface CreateSessionResult {
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
 * Create a scheduled session when a student books an available time slot
 * Sessions are automatically confirmed at booking time (no pending state)
 */
export async function createScheduledSession(
  providerId: string,
  date: string, // ISO date string (YYYY-MM-DD)
  time: string, // Time string (HH:MM)
  sessionType: 'tutoring' | 'counseling' | 'test-prep',
  subject?: string
): Promise<CreateSessionResult> {
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

  // Create the session - automatically confirmed (scheduled status)
  const newSession: Session = {
    id: crypto.randomUUID(),
    studentId,
    providerId,
    serviceTypeId: sessionType, // Use session type as service type ID
    sessionType,
    subject,
    scheduledStartTime: startTime,
    scheduledEndTime: endTime,
    status: 'scheduled', // Automatically confirmed at booking time
    priceCents: 0, // Will be set based on service type
    amountChargedCents: 0,
    amountRefundedCents: 0,
    bookedAt: new Date().toISOString(),
    bookedBy: studentId,
    availabilityId: `availability-${providerId}-${Date.now()}`, // Generate availability ID
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // Add to dev session store (temporary development-only solution)
    addDevSession(newSession);
    return { success: true, sessionId: newSession.id };
  } catch (error) {
    console.error('Error creating scheduled session:', error);
    return { success: false, error: 'Failed to create session. Please try again.' };
  }
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
 * Get user name by user ID
 * Used by client components to display provider names
 */
export async function getUserNameById(userId: string): Promise<{ name: string | null; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { name: null, error: 'User not found' };
    }
    return { name: user.name };
  } catch (error) {
    console.error('Error fetching user name:', error);
    return { name: null, error: 'Failed to fetch user name' };
  }
}

/**
 * Create a Stripe Checkout session for a scheduled session
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

/**
 * Create Zoom meeting for a session (server-side)
 * This accepts session data directly since we can't access localStorage server-side
 */
export async function createZoomMeetingForSessionData(sessionData: Session): Promise<{
  success: boolean;
  error?: string;
  zoomJoinUrl?: string;
  zoomMeetingId?: string;
}> {
  // Check if Zoom is configured
  const { isZoomConfigured, createZoomMeeting } = await import('@/lib/zoom/api');
  if (!isZoomConfigured()) {
    console.warn('Zoom is not configured. Skipping Zoom meeting creation.');
    return { success: false, error: 'Zoom is not configured' };
  }

  try {
    // Get provider user to get their email
    const provider = await getUserById(sessionData.providerId);
    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    // Calculate duration in minutes
    const startTime = new Date(sessionData.scheduledStartTime);
    const endTime = new Date(sessionData.scheduledEndTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Create meeting topic based on session type
    const topic = sessionData.subject
      ? `${sessionData.sessionType} - ${sessionData.subject}`
      : `${sessionData.sessionType} Session`;

    // Create Zoom meeting
    const zoomMeeting = await createZoomMeeting({
      topic,
      startTime: sessionData.scheduledStartTime,
      duration: durationMinutes,
      hostEmail: provider.email,
    });

    return {
      success: true,
      zoomJoinUrl: zoomMeeting.joinUrl,
      zoomMeetingId: zoomMeeting.meetingId,
    };
  } catch (error) {
    console.error('Error creating Zoom meeting for session:', error);
    // Don't fail the booking if Zoom creation fails
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Zoom meeting',
    };
  }
}

/**
 * Create sessions from booking state and create Zoom meetings for each
 * This is called after successful payment
 */
export async function createSessionsFromBookingState(bookingState: {
  service: 'tutoring' | 'counseling' | 'test-prep' | 'virtual-tour' | null;
  plan: string | null;
  subject?: string | null;
  topic?: string | null;
  school?: { displayName: string; normalizedName: string } | null;
  selectedSessions: Array<{ date: Date; time: string; displayString: string }>;
  provider: string | null;
}): Promise<{
  success: boolean;
  error?: string;
  sessions?: Session[];
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'You must be logged in' };
  }

  if (!session.roles.includes('student')) {
    return { success: false, error: 'Only students can create sessions' };
  }

  if (!bookingState.provider || !bookingState.service) {
    return { success: false, error: 'Invalid booking state' };
  }

  const studentId = session.userId;
  const providerId = bookingState.provider;
  const createdSessions: Session[] = [];

  try {
    // Create a session for each selected time slot
    for (const selectedSession of bookingState.selectedSessions) {
      // Parse date and time to create ISO datetime strings
      const [time, period] = selectedSession.time.split(' ');
      const [hours, minutes] = time.split(':');
      let hour24 = parseInt(hours, 10);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;

      const sessionDate = new Date(selectedSession.date);
      sessionDate.setHours(hour24, parseInt(minutes, 10), 0, 0);
      const startTime = sessionDate.toISOString();

      // Determine duration based on plan
      let durationMinutes = 60; // Default 1 hour
      if (bookingState.plan === 'counseling-30min') {
        durationMinutes = 30;
      } else if (bookingState.plan === 'counseling-60min' || bookingState.plan === 'counseling-monthly') {
        durationMinutes = 60;
      }

      const endTime = new Date(sessionDate.getTime() + durationMinutes * 60 * 1000).toISOString();

      // Map service to session type
      let sessionType: 'tutoring' | 'counseling' | 'test-prep' = 'tutoring';
      if (bookingState.service === 'counseling' || bookingState.service === 'virtual-tour') {
        sessionType = 'counseling';
      } else if (bookingState.service === 'test-prep') {
        sessionType = 'test-prep';
      }

      // Create the session
      const newSession: Session = {
        id: crypto.randomUUID(),
        studentId,
        providerId,
        serviceTypeId: bookingState.service,
        sessionType,
        subject: bookingState.subject || undefined,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        status: 'scheduled',
        priceCents: 0, // Will be set based on service type
        amountChargedCents: 0,
        amountRefundedCents: 0,
        bookedAt: new Date().toISOString(),
        bookedBy: studentId,
        availabilityId: `availability-${providerId}-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to dev session store (client-side only in dev mode)
      // Note: In production, this would be saved to database
      // For now, we'll return the session data and let the client handle storage

      createdSessions.push(newSession);

      // Create Zoom meeting for this session (server-side)
      try {
        const zoomResult = await createZoomMeetingForSessionData(newSession);
        if (zoomResult.success && zoomResult.zoomJoinUrl && zoomResult.zoomMeetingId) {
          // Update session with Zoom data
          newSession.zoomJoinUrl = zoomResult.zoomJoinUrl;
          newSession.zoomMeetingId = zoomResult.zoomMeetingId;
          newSession.updatedAt = new Date().toISOString();
          
          // Update in dev store if client-side
          if (typeof window !== 'undefined') {
            const { updateDevSession } = await import('@/lib/devSessionStore');
            updateDevSession(newSession.id, {
              zoomJoinUrl: zoomResult.zoomJoinUrl,
              zoomMeetingId: zoomResult.zoomMeetingId,
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          console.warn(`Failed to create Zoom meeting for session ${newSession.id}:`, zoomResult.error);
        }
      } catch (zoomError) {
        console.error(`Error creating Zoom meeting for session ${newSession.id}:`, zoomError);
        // Don't fail the entire booking if Zoom creation fails
      }
    }

    // Return sessions with Zoom data for client to store
    // In production, sessions would already be in database
    return { 
      success: true, 
      sessions: createdSessions,
    };
  } catch (error) {
    console.error('Error creating sessions from booking state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sessions',
    };
  }
}

