/**
 * Email templates for IvyWay booking confirmations
 */

/**
 * Generate student confirmation email HTML
 */
export function generateStudentConfirmationEmail(data: {
  providerName: string;
  subject?: string;
  topic?: string;
  dateTime: string; // Formatted date and time in student's timezone
  zoomJoinUrl: string;
  dashboardUrl: string;
}): string {
  const { providerName, subject, topic, dateTime, zoomJoinUrl, dashboardUrl } = data;
  
  const sessionDetails = [];
  if (subject) sessionDetails.push(`<strong>Subject:</strong> ${subject}`);
  if (topic) sessionDetails.push(`<strong>Topic:</strong> ${topic}`);
  
  const sessionDetailsHtml = sessionDetails.length > 0
    ? `<div style="margin: 20px 0;">
         ${sessionDetails.join('<br>')}
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your IvyWay session is confirmed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      Your IvyWay session is confirmed
    </h1>
    
    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      Great news! Your session with <strong>${escapeHtml(providerName)}</strong> has been confirmed.
    </p>
    
    ${sessionDetailsHtml}
    
    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Session Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;">
        <strong>Date & Time:</strong> ${escapeHtml(dateTime)}
      </p>
    </div>
    
    <div style="margin: 30px 0;">
      <a href="${escapeHtml(zoomJoinUrl)}" 
         style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-align: center; margin-bottom: 10px;">
        Join Zoom Meeting
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      You can view all your sessions and manage your bookings in your dashboard.
    </p>
    
    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}" 
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 40px 0 20px 0;">
    
    <p style="color: #999; font-size: 12px; margin: 0;">
      This is an automated confirmation email from IvyWay. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate provider notification email HTML
 */
export function generateProviderNotificationEmail(data: {
  studentName: string;
  subject?: string;
  topic?: string;
  dateTime: string; // Formatted date and time
  zoomStartUrl: string;
  dashboardUrl: string;
}): string {
  const { studentName, subject, topic, dateTime, zoomStartUrl, dashboardUrl } = data;
  
  const sessionDetails = [];
  if (subject) sessionDetails.push(`<strong>Subject:</strong> ${subject}`);
  if (topic) sessionDetails.push(`<strong>Topic:</strong> ${topic}`);
  
  const sessionDetailsHtml = sessionDetails.length > 0
    ? `<div style="margin: 20px 0;">
         ${sessionDetails.join('<br>')}
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You have a new IvyWay session</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      You have a new IvyWay session
    </h1>
    
    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      A new session has been booked with <strong>${escapeHtml(studentName)}</strong>.
    </p>
    
    ${sessionDetailsHtml}
    
    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Session Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;">
        <strong>Date & Time:</strong> ${escapeHtml(dateTime)}
      </p>
    </div>
    
    <div style="margin: 30px 0;">
      <a href="${escapeHtml(zoomStartUrl)}" 
         style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-align: center; margin-bottom: 10px;">
        Start Zoom Meeting
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      You can view all your sessions and manage your schedule in your dashboard.
    </p>
    
    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}" 
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 40px 0 20px 0;">
    
    <p style="color: #999; font-size: 12px; margin: 0;">
      This is an automated notification email from IvyWay. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Format date and time in a specific timezone
 * @param isoString - ISO 8601 datetime string (UTC)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Formatted date and time string
 */
export function formatDateTimeInTimezone(
  isoString: string,
  timezone?: string
): string {
  const date = new Date(isoString);
  
  if (!timezone) {
    // Default to UTC if no timezone provided
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  }

  try {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    });
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    console.warn(`Invalid timezone "${timezone}", falling back to UTC`);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  }
}






