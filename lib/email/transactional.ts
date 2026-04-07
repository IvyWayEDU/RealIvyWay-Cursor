import 'server-only';

import { sendEmail } from '@/lib/email/sendEmail';
import { getUserById } from '@/lib/auth/storage';
import type { Session, User } from '@/lib/models/types';
import {
  formatDateTimeInTimezone,
  generateCancellationEmail,
  generateNoShowEmail,
  generatePayoutPaidEmail,
  generateProviderNotificationEmail,
  generateRescheduleEmail,
  generateSessionFollowupEmail,
  generateStudentConfirmationEmail,
  generateProviderThankYouEmail,
  generateWelcomeEmail,
} from '@/lib/email/templates';

function baseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}

function moneyUsd(cents: number): string {
  const n = Number(cents || 0) / 100;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
}

function safeTimezone(session: any): string {
  const tz = typeof session?.timezone === 'string' ? session.timezone.trim() : '';
  return tz || 'UTC';
}

function sessionStartIso(session: any): string {
  return (
    String(session?.scheduledStartTime || session?.scheduledStart || session?.startTime || session?.datetime || '').trim() ||
    new Date().toISOString()
  );
}

function sessionEndIso(session: any): string {
  return (
    String(session?.scheduledEndTime || session?.scheduledEnd || session?.endTime || session?.end_datetime || '').trim() ||
    new Date().toISOString()
  );
}

export async function sendWelcomeEmailForUser(user: Pick<User, 'email' | 'name' | 'roles'>): Promise<boolean> {
  const to = String(user.email || '').trim();
  if (!to) return false;
  const dash = `${baseUrl()}/dashboard`;
  const html = generateWelcomeEmail({ name: user.name || 'there', dashboardUrl: dash });
  const result = await sendEmail({ to, subject: 'Welcome to IvyWay', html });
  if (!result.success) {
    console.warn('[email] welcome send failed', { error: result.error });
  }
  return result.success;
}

export async function sendBookingConfirmationEmailsForSession(session: Session): Promise<{
  studentEmailSent: boolean;
  providerEmailSent: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  const b = baseUrl();

  const student = await getUserById(session.studentId);
  const provider = await getUserById(session.providerId);
  if (!student) errors.push(`Student not found for ID: ${session.studentId}`);
  if (!provider) errors.push(`Provider not found for ID: ${session.providerId}`);

  const tz = safeTimezone(session);
  const dt = formatDateTimeInTimezone(sessionStartIso(session), tz);

  let studentEmailSent = false;
  let providerEmailSent = false;

  if (student) {
    const html = generateStudentConfirmationEmail({
      providerName: provider?.name || (session as any).providerName || 'Your provider',
      subject: session.subject,
      topic: session.topic ?? undefined,
      dateTime: dt,
      zoom_join_url: (session as any).zoom_join_url || (session as any).zoomJoinUrl || undefined,
      dashboardUrl: `${b}/dashboard/student`,
    });
    const r = await sendEmail({ to: student.email, subject: 'Your IvyWay session is confirmed', html });
    studentEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send student booking email: ${r.error}`);
  }

  if (provider) {
    const html = generateProviderNotificationEmail({
      studentName: student?.name || (session as any).studentName || 'A student',
      subject: session.subject,
      topic: session.topic ?? undefined,
      dateTime: dt,
      zoomStartUrl: (session as any).zoomStartUrl || (session as any).zoom_start_url || undefined,
      dashboardUrl: `${b}/dashboard/provider`,
    });
    const r = await sendEmail({ to: provider.email, subject: 'You have a new IvyWay session', html });
    providerEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send provider booking email: ${r.error}`);
  }

  return { studentEmailSent, providerEmailSent, errors: errors.length ? errors : undefined };
}

export async function sendCancellationEmailsForSession(session: Session): Promise<{
  studentEmailSent: boolean;
  providerEmailSent: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  const b = baseUrl();

  const student = await getUserById(session.studentId);
  const provider = await getUserById(session.providerId);
  if (!student) errors.push(`Student not found for ID: ${session.studentId}`);
  if (!provider) errors.push(`Provider not found for ID: ${session.providerId}`);

  const tz = safeTimezone(session);
  const dt = formatDateTimeInTimezone(sessionStartIso(session), tz);

  const reasonLabel =
    typeof (session as any)?.cancellationReason === 'string' && (session as any).cancellationReason.trim()
      ? String((session as any).cancellationReason).trim()
      : undefined;

  let studentEmailSent = false;
  let providerEmailSent = false;

  if (student) {
    const html = generateCancellationEmail({
      recipientRole: 'student',
      otherPartyName: provider?.name || (session as any).providerName || 'Your provider',
      dateTime: dt,
      dashboardUrl: `${b}/dashboard/student`,
      reasonLabel,
    });
    const r = await sendEmail({ to: student.email, subject: 'Your IvyWay session was cancelled', html });
    studentEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send student cancellation email: ${r.error}`);
  }

  if (provider) {
    const html = generateCancellationEmail({
      recipientRole: 'provider',
      otherPartyName: student?.name || (session as any).studentName || 'A student',
      dateTime: dt,
      dashboardUrl: `${b}/dashboard/provider`,
      reasonLabel,
    });
    const r = await sendEmail({ to: provider.email, subject: 'A session was cancelled', html });
    providerEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send provider cancellation email: ${r.error}`);
  }

  return { studentEmailSent, providerEmailSent, errors: errors.length ? errors : undefined };
}

export async function sendRescheduleEmails(args: {
  before: Session;
  after: Session;
}): Promise<{ studentEmailSent: boolean; providerEmailSent: boolean; errors?: string[] }> {
  const errors: string[] = [];
  const b = baseUrl();

  const student = await getUserById(args.after.studentId);
  const provider = await getUserById(args.after.providerId);
  if (!student) errors.push(`Student not found for ID: ${args.after.studentId}`);
  if (!provider) errors.push(`Provider not found for ID: ${args.after.providerId}`);

  const tz = safeTimezone(args.after);
  const oldDt = formatDateTimeInTimezone(sessionStartIso(args.before), tz);
  const newDt = formatDateTimeInTimezone(sessionStartIso(args.after), tz);

  let studentEmailSent = false;
  let providerEmailSent = false;

  if (student) {
    const html = generateRescheduleEmail({
      recipientRole: 'student',
      otherPartyName: provider?.name || (args.after as any).providerName || 'Your provider',
      oldDateTime: oldDt,
      newDateTime: newDt,
      dashboardUrl: `${b}/dashboard/student`,
    });
    const r = await sendEmail({ to: student.email, subject: 'Your IvyWay session was rescheduled', html });
    studentEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send student reschedule email: ${r.error}`);
  }

  if (provider) {
    const html = generateRescheduleEmail({
      recipientRole: 'provider',
      otherPartyName: student?.name || (args.after as any).studentName || 'A student',
      oldDateTime: oldDt,
      newDateTime: newDt,
      dashboardUrl: `${b}/dashboard/provider`,
    });
    const r = await sendEmail({ to: provider.email, subject: 'A session was rescheduled', html });
    providerEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send provider reschedule email: ${r.error}`);
  }

  return { studentEmailSent, providerEmailSent, errors: errors.length ? errors : undefined };
}

export async function sendNoShowEmailsForSession(session: Session): Promise<{
  studentEmailSent: boolean;
  providerEmailSent: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  const b = baseUrl();

  const student = await getUserById(session.studentId);
  const provider = await getUserById(session.providerId);
  if (!student) errors.push(`Student not found for ID: ${session.studentId}`);
  if (!provider) errors.push(`Provider not found for ID: ${session.providerId}`);

  const tz = safeTimezone(session);
  const dt = formatDateTimeInTimezone(sessionStartIso(session), tz);

  const noShowPartyRaw = String((session as any)?.noShowParty || '').trim().toLowerCase();
  const noShowParty: 'student' | 'provider' | 'both' =
    noShowPartyRaw === 'student' ? 'student' : noShowPartyRaw === 'provider' ? 'provider' : 'both';

  let studentEmailSent = false;
  let providerEmailSent = false;

  if (student) {
    const html = generateNoShowEmail({
      recipientRole: 'student',
      noShowParty,
      otherPartyName: provider?.name || (session as any).providerName || 'Your provider',
      dateTime: dt,
      dashboardUrl: `${b}/dashboard/student`,
    });
    const r = await sendEmail({ to: student.email, subject: 'IvyWay session marked no-show', html });
    studentEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send student no-show email: ${r.error}`);
  }

  if (provider) {
    const html = generateNoShowEmail({
      recipientRole: 'provider',
      noShowParty,
      otherPartyName: student?.name || (session as any).studentName || 'A student',
      dateTime: dt,
      dashboardUrl: `${b}/dashboard/provider`,
    });
    const r = await sendEmail({ to: provider.email, subject: 'IvyWay session marked no-show', html });
    providerEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send provider no-show email: ${r.error}`);
  }

  return { studentEmailSent, providerEmailSent, errors: errors.length ? errors : undefined };
}

export async function sendPayoutPaidEmail(args: {
  providerId: string;
  amountCents: number;
  payoutMethod?: string;
  payoutDestinationMasked?: string;
  paidAt?: string;
}): Promise<boolean> {
  const provider = await getUserById(args.providerId);
  if (!provider) return false;

  const html = generatePayoutPaidEmail({
    providerName: provider.name || 'there',
    amountUsd: moneyUsd(args.amountCents),
    payoutMethod: args.payoutMethod,
    payoutDestinationMasked: args.payoutDestinationMasked,
    paidAt: args.paidAt,
    dashboardUrl: `${baseUrl()}/dashboard/provider`,
  });
  const r = await sendEmail({ to: provider.email, subject: 'Your IvyWay payout was sent', html });
  if (!r.success) {
    console.warn('[email] payout paid send failed', { providerId: args.providerId, error: r.error });
  }
  return r.success;
}

export async function sendSessionFollowupEmailsForSession(
  session: Session,
  opts: { sendProviderThankYou?: boolean } = {}
): Promise<{
  studentEmailSent: boolean;
  providerEmailSent: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  const b = baseUrl();

  const student = await getUserById(session.studentId);
  const provider = await getUserById(session.providerId);
  if (!student) errors.push(`Student not found for ID: ${session.studentId}`);
  if (!provider) errors.push(`Provider not found for ID: ${session.providerId}`);

  const tz = safeTimezone(session);
  const dt = formatDateTimeInTimezone(sessionEndIso(session), tz);

  let studentEmailSent = false;
  let providerEmailSent = false;

  const bookUrl = `${b}/dashboard/book`;
  const feedbackUrl = `${b}/dashboard/sessions/${encodeURIComponent(String((session as any)?.id || ''))}?review=1`;
  const aiUrl = `${b}/dashboard/ai`;

  if (student) {
    const html = generateSessionFollowupEmail({
      studentName: student.name || 'there',
      providerName: provider?.name || (session as any).providerName || 'your provider',
      subject: session.subject,
      topic: (session as any)?.topic ?? undefined,
      dateTime: dt,
      bookUrl,
      feedbackUrl,
      aiUrl,
      dashboardUrl: `${b}/dashboard/student`,
    });
    const r = await sendEmail({ to: student.email, subject: 'How was your IvyWay session?', html });
    studentEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send student follow-up email: ${r.error}`);
  }

  const sendProviderThankYou = opts.sendProviderThankYou !== false;
  if (sendProviderThankYou && provider) {
    const html = generateProviderThankYouEmail({
      providerName: provider.name || 'there',
      studentName: student?.name || (session as any).studentName || 'a student',
      dateTime: dt,
      dashboardUrl: `${b}/dashboard/provider`,
    });
    const r = await sendEmail({ to: provider.email, subject: 'Thank you for your IvyWay session', html });
    providerEmailSent = r.success;
    if (!r.success) errors.push(`Failed to send provider thank-you email: ${r.error}`);
  }

  return { studentEmailSent, providerEmailSent, errors: errors.length ? errors : undefined };
}

