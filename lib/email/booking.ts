/**
 * Booking confirmation email service
 * Sends emails to students and providers when a booking is confirmed
 */

import { Session } from '@/lib/models/types';
import { getUserById } from '@/lib/auth/storage';
import { sendEmail } from './utils';
import {
  generateStudentConfirmationEmail,
  generateProviderNotificationEmail,
  formatDateTimeInTimezone,
} from './templates';

/**
 * Send confirmation emails for a paid booking
 * Sends to both student and provider
 * @param booking - The paid booking/session
 * @returns Success status for each email
 */
export async function sendBookingConfirmationEmails(
  booking: Session
): Promise<{
  studentEmailSent: boolean;
  providerEmailSent: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  let studentEmailSent = false;
  let providerEmailSent = false;

  // Get base URL for dashboard links (server-only, not exposed to client)
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  // Validate required booking data
  if (!booking.zoomJoinUrl) {
    errors.push('Zoom join URL is missing from booking');
    return { studentEmailSent, providerEmailSent, errors };
  }

  if (!booking.zoomStartUrl) {
    errors.push('Zoom start URL is missing from booking');
    return { studentEmailSent, providerEmailSent, errors };
  }

  // Get student information
  const student = await getUserById(booking.studentId);
  if (!student) {
    errors.push(`Student not found for ID: ${booking.studentId}`);
  }

  // Get provider information
  const provider = await getUserById(booking.providerId);
  if (!provider) {
    errors.push(`Provider not found for ID: ${booking.providerId}`);
  }

  // Format date and time in student's timezone (or UTC if not specified)
  const studentTimezone = booking.timezone || 'UTC';
  const formattedDateTime = formatDateTimeInTimezone(
    booking.scheduledStartTime,
    studentTimezone
  );

  // Send student confirmation email
  if (student) {
    try {
      const studentEmailHtml = generateStudentConfirmationEmail({
        providerName: provider?.name || 'Your provider',
        subject: booking.subject,
        topic: booking.topic ?? undefined,
        dateTime: formattedDateTime,
        zoomJoinUrl: booking.zoomJoinUrl,
        dashboardUrl: `${baseUrl}/dashboard/student`,
      });

      const result = await sendEmail(
        student.email,
        'Your IvyWay session is confirmed',
        studentEmailHtml
      );

      if (result.success) {
        studentEmailSent = true;
        console.log('Student confirmation email sent:', {
          bookingId: booking.id,
          studentEmail: student.email,
        });
      } else {
        errors.push(`Failed to send student email: ${result.error}`);
        console.error('Failed to send student confirmation email:', {
          bookingId: booking.id,
          studentEmail: student.email,
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Error sending student email: ${errorMessage}`);
      console.error('Error sending student confirmation email:', {
        bookingId: booking.id,
        studentEmail: student.email,
        error: errorMessage,
      });
    }
  }

  // Send provider notification email
  if (provider) {
    try {
      // Format date and time for provider (use booking timezone or UTC)
      const providerFormattedDateTime = formatDateTimeInTimezone(
        booking.scheduledStartTime,
        booking.timezone || 'UTC'
      );

      const providerEmailHtml = generateProviderNotificationEmail({
        studentName: student?.name || 'A student',
        subject: booking.subject,
        topic: booking.topic ?? undefined,
        dateTime: providerFormattedDateTime,
        zoomStartUrl: booking.zoomStartUrl,
        dashboardUrl: `${baseUrl}/dashboard/provider`,
      });

      const result = await sendEmail(
        provider.email,
        'You have a new IvyWay session',
        providerEmailHtml
      );

      if (result.success) {
        providerEmailSent = true;
        console.log('Provider notification email sent:', {
          bookingId: booking.id,
          providerEmail: provider.email,
        });
      } else {
        errors.push(`Failed to send provider email: ${result.error}`);
        console.error('Failed to send provider notification email:', {
          bookingId: booking.id,
          providerEmail: provider.email,
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Error sending provider email: ${errorMessage}`);
      console.error('Error sending provider notification email:', {
        bookingId: booking.id,
        providerEmail: provider.email,
        error: errorMessage,
      });
    }
  }

  return {
    studentEmailSent,
    providerEmailSent,
    errors: errors.length > 0 ? errors : undefined,
  };
}







