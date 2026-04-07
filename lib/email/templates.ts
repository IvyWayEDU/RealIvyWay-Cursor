/**
 * Email templates for IvyWay booking confirmations
 */

function baseShell(args: { title: string; innerHtml: string }): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(args.title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    ${args.innerHtml}
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 40px 0 20px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">
      This is an automated email from IvyWay. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate student confirmation email HTML
 */
export function generateStudentConfirmationEmail(data: {
  providerName: string;
  subject?: string;
  topic?: string;
  dateTime: string; // Formatted date and time in student's timezone
  zoom_join_url?: string;
  dashboardUrl: string;
}): string {
  const { providerName, subject, topic, dateTime, zoom_join_url, dashboardUrl } = data;
  
  const sessionDetails = [];
  if (subject) sessionDetails.push(`<strong>Subject:</strong> ${subject}`);
  if (topic) sessionDetails.push(`<strong>Topic:</strong> ${topic}`);
  
  const sessionDetailsHtml = sessionDetails.length > 0
    ? `<div style="margin: 20px 0;">
         ${sessionDetails.join('<br>')}
       </div>`
    : '';

  const joinCta = zoom_join_url
    ? `<div style="margin: 30px 0;">
         <a href="${escapeHtml(zoom_join_url)}"
            style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-align: center; margin-bottom: 10px;">
           Join Zoom Meeting
         </a>
       </div>`
    : `<div style="background-color: #fff7ed; border-radius: 6px; padding: 16px; margin: 20px 0;">
         <p style="margin: 0; color: #9a3412; font-size: 14px;">
           Your Zoom link will appear in your dashboard once it’s available.
         </p>
       </div>`;

  return baseShell({
    title: 'Your IvyWay session is confirmed',
    innerHtml: `
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
    
    ${joinCta}
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      You can view all your sessions and manage your bookings in your dashboard.
    </p>
    
    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}" 
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    `.trim(),
  });
}

/**
 * Generate provider notification email HTML
 */
export function generateProviderNotificationEmail(data: {
  studentName: string;
  subject?: string;
  topic?: string;
  dateTime: string; // Formatted date and time
  zoomStartUrl?: string;
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

  const startCta = zoomStartUrl
    ? `<div style="margin: 30px 0;">
         <a href="${escapeHtml(zoomStartUrl)}" 
            style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-align: center; margin-bottom: 10px;">
           Start Zoom Meeting
         </a>
       </div>`
    : `<div style="background-color: #fff7ed; border-radius: 6px; padding: 16px; margin: 20px 0;">
         <p style="margin: 0; color: #9a3412; font-size: 14px;">
           Your Zoom host link will appear in your dashboard once it’s available.
         </p>
       </div>`;

  return baseShell({
    title: 'You have a new IvyWay session',
    innerHtml: `
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
    
    ${startCta}
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      You can view all your sessions and manage your schedule in your dashboard.
    </p>
    
    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}" 
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    `.trim(),
  });
}

export function generateWelcomeEmail(data: { name: string; dashboardUrl: string }): string {
  const { name, dashboardUrl } = data;
  return baseShell({
    title: 'Welcome to IvyWay',
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      Welcome to IvyWay
    </h1>

    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      Hi <strong>${escapeHtml(name || 'there')}</strong> — your account is ready.
    </p>

    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      You can manage your profile, bookings, and messages from your dashboard.
    </p>

    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-align: center;">
        Go to Dashboard
      </a>
    </div>
    `.trim(),
  });
}

export function generateCancellationEmail(data: {
  recipientRole: 'student' | 'provider';
  otherPartyName: string;
  dateTime: string;
  dashboardUrl: string;
  reasonLabel?: string;
}): string {
  const { recipientRole, otherPartyName, dateTime, dashboardUrl, reasonLabel } = data;
  const heading = 'Session cancelled';
  const otherLabel = recipientRole === 'student' ? 'Provider' : 'Student';
  const reasonHtml = reasonLabel
    ? `<p style="margin: 0; color: #666; font-size: 14px;"><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</p>`
    : '';

  return baseShell({
    title: heading,
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      ${escapeHtml(heading)}
    </h1>

    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      This session has been cancelled.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Session Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;">
        <strong>Date & Time:</strong> ${escapeHtml(dateTime)}
      </p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">
        <strong>${escapeHtml(otherLabel)}:</strong> ${escapeHtml(otherPartyName)}
      </p>
      ${reasonHtml}
    </div>

    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    `.trim(),
  });
}

export function generateRescheduleEmail(data: {
  recipientRole: 'student' | 'provider';
  otherPartyName: string;
  oldDateTime: string;
  newDateTime: string;
  dashboardUrl: string;
}): string {
  const { recipientRole, otherPartyName, oldDateTime, newDateTime, dashboardUrl } = data;
  const otherLabel = recipientRole === 'student' ? 'Provider' : 'Student';
  return baseShell({
    title: 'Session rescheduled',
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      Session rescheduled
    </h1>

    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      Your session has been rescheduled.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Updated Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;"><strong>${escapeHtml(otherLabel)}:</strong> ${escapeHtml(otherPartyName)}</p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;"><strong>Previous:</strong> ${escapeHtml(oldDateTime)}</p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;"><strong>New:</strong> ${escapeHtml(newDateTime)}</p>
    </div>

    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    `.trim(),
  });
}

export function generatePayoutPaidEmail(data: {
  providerName: string;
  amountUsd: string;
  payoutMethod?: string;
  payoutDestinationMasked?: string;
  paidAt?: string;
  dashboardUrl: string;
}): string {
  const { providerName, amountUsd, payoutMethod, payoutDestinationMasked, paidAt, dashboardUrl } = data;
  const details: string[] = [];
  if (payoutMethod) details.push(`<strong>Method:</strong> ${escapeHtml(payoutMethod)}`);
  if (payoutDestinationMasked) details.push(`<strong>Destination:</strong> ${escapeHtml(payoutDestinationMasked)}`);
  if (paidAt) details.push(`<strong>Paid at:</strong> ${escapeHtml(paidAt)}`);
  const detailsHtml = details.length
    ? `<div style="margin: 10px 0 0 0; color: #666; font-size: 14px;">${details.join('<br>')}</div>`
    : '';

  return baseShell({
    title: 'Payout sent',
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      Payout sent
    </h1>

    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      Hi <strong>${escapeHtml(providerName || 'there')}</strong> — your payout has been sent.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0; color: #333; font-weight: 600;">Amount</p>
      <p style="margin: 10px 0 0 0; color: #111; font-size: 22px; font-weight: 700;">
        ${escapeHtml(amountUsd)}
      </p>
      ${detailsHtml}
    </div>

    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        View earnings →
      </a>
    </div>
    `.trim(),
  });
}

export function generateNoShowEmail(data: {
  recipientRole: 'student' | 'provider';
  noShowParty: 'student' | 'provider' | 'both';
  otherPartyName: string;
  dateTime: string;
  dashboardUrl: string;
}): string {
  const { recipientRole, noShowParty, otherPartyName, dateTime, dashboardUrl } = data;
  const heading =
    noShowParty === 'both'
      ? 'Session marked no-show (both parties)'
      : noShowParty === 'student'
        ? 'Session marked student no-show'
        : 'Session marked provider no-show';
  const otherLabel = recipientRole === 'student' ? 'Provider' : 'Student';

  return baseShell({
    title: heading,
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      ${escapeHtml(heading)}
    </h1>

    <p style="color: #666; font-size: 16px; margin: 20px 0;">
      This session has been marked as a no-show.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Session Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;">
        <strong>Date & Time:</strong> ${escapeHtml(dateTime)}
      </p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">
        <strong>${escapeHtml(otherLabel)}:</strong> ${escapeHtml(otherPartyName)}
      </p>
    </div>

    <div style="margin: 30px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    `.trim(),
  });
}

export function generateSessionFollowupEmail(data: {
  studentName: string;
  providerName: string;
  subject?: string;
  topic?: string;
  dateTime: string;
  bookUrl: string;
  feedbackUrl: string;
  aiUrl: string;
  dashboardUrl: string;
}): string {
  const { studentName, providerName, subject, topic, dateTime, bookUrl, feedbackUrl, aiUrl, dashboardUrl } = data;

  const sessionDetails = [];
  if (subject) sessionDetails.push(`<strong>Subject:</strong> ${escapeHtml(subject)}`);
  if (topic) sessionDetails.push(`<strong>Topic:</strong> ${escapeHtml(topic)}`);
  const sessionDetailsHtml = sessionDetails.length
    ? `<div style="margin: 16px 0; color: #666; font-size: 14px;">
         ${sessionDetails.join('<br>')}
       </div>`
    : '';

  return baseShell({
    title: 'Thanks for meeting with IvyWay',
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      Thanks for your session, ${escapeHtml(studentName || 'there')}
    </h1>

    <p style="color: #666; font-size: 16px; margin: 16px 0;">
      Hope your session with <strong>${escapeHtml(providerName)}</strong> was helpful.
    </p>

    ${sessionDetailsHtml}

    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 18px; margin: 18px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Session Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;">
        <strong>Date & Time:</strong> ${escapeHtml(dateTime)}
      </p>
    </div>

    <p style="color: #666; font-size: 14px; margin: 18px 0 10px 0;">
      Quick next steps:
    </p>

    <div style="margin: 18px 0;">
      <a href="${escapeHtml(bookUrl)}"
         style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; text-align: center; margin: 0 10px 10px 0;">
        Book another session
      </a>
      <a href="${escapeHtml(feedbackUrl)}"
         style="display: inline-block; background-color: #ffffff; color: #4F46E5; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; text-align: center; border: 1px solid #4F46E5; margin: 0 10px 10px 0;">
        Leave feedback
      </a>
      <a href="${escapeHtml(aiUrl)}"
         style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; text-align: center; margin: 0 10px 10px 0;">
        Continue with IvyWay AI
      </a>
    </div>

    <div style="margin: 26px 0 0 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; color: #4F46E5; text-decoration: none; font-weight: 500;">
        Go to Dashboard →
      </a>
    </div>
    `.trim(),
  });
}

export function generateProviderThankYouEmail(data: {
  providerName: string;
  studentName: string;
  dateTime: string;
  dashboardUrl: string;
}): string {
  const { providerName, studentName, dateTime, dashboardUrl } = data;
  return baseShell({
    title: 'Thank you for your IvyWay session',
    innerHtml: `
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px; font-weight: 600;">
      Thank you, ${escapeHtml(providerName || 'there')}
    </h1>

    <p style="color: #666; font-size: 16px; margin: 16px 0;">
      Thanks for meeting with <strong>${escapeHtml(studentName || 'a student')}</strong>.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 6px; padding: 18px; margin: 18px 0;">
      <p style="margin: 0 0 10px 0; color: #333; font-weight: 600;">Session Details</p>
      <p style="margin: 0; color: #666; font-size: 16px;">
        <strong>Date & Time:</strong> ${escapeHtml(dateTime)}
      </p>
    </div>

    <p style="color: #666; font-size: 14px; margin: 18px 0;">
      You can review your upcoming sessions and earnings anytime in your dashboard.
    </p>

    <div style="margin: 26px 0 0 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; text-align: center;">
        Go to Dashboard
      </a>
    </div>
    `.trim(),
  });
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
  } catch {
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






