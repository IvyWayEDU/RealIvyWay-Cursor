// Backwards-compatible wrapper.
// Central sender lives in `lib/email/sendEmail.ts`.
import { sendEmail as sendEmailCentral } from './sendEmail';

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const result = await sendEmailCentral({ to, subject, html });
  return result.success ? { success: true } : { success: false, error: result.error };
}






