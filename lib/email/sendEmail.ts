import { Resend } from 'resend';

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
};

type SendEmailResult =
  | { success: true; id?: string }
  | { success: false; error: string };

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    return { success: false, error: 'RESEND_API_KEY is not configured' };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    return { success: false, error: 'EMAIL_FROM is not configured' };
  }

  try {
    const result = await client.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

