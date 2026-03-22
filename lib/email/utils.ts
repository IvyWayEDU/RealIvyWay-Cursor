import { Resend } from 'resend';

// Initialize Resend client
let resendClient: Resend | null = null;

/**
 * Get or initialize Resend client
 * Reads RESEND_API_KEY from environment variables
 */
function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured. Email sending will be disabled.');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Send an email using Resend
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content of the email
 * @param from - Sender email address (defaults to EMAIL_FROM env var)
 * @returns Success status and optional error message
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();
  if (!client) {
    return { success: false, error: 'Resend is not configured' };
  }

  const fromEmail = from || process.env.EMAIL_FROM;
  if (!fromEmail) {
    return { success: false, error: 'EMAIL_FROM is not configured' };
  }

  try {
    const result = await client.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });

    if (result.error) {
      // Log error without exposing API keys
      console.error('Resend API error:', {
        message: result.error.message,
        name: result.error.name,
      });
      return { success: false, error: result.error.message };
    }

    console.log('Email sent successfully:', {
      subject,
      emailId: result.data?.id,
    });

    return { success: true };
  } catch (error) {
    // Log error without exposing sensitive information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending email:', {
      subject,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}






