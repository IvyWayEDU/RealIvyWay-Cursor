import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/requireAuth';
import { getDisplayRole } from '@/lib/auth/utils';
import { addSupportMessage, createSupportTicket } from '@/lib/support/ticketingStorage';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/support-ticket',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const form = await request.formData();
    const rawSubject = String(form.get('subject') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();
    const attachment = form.get('attachment');

    if (!rawSubject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (rawSubject.length > 140) {
      return NextResponse.json({ error: 'Subject is too long (max 140 characters)' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // The ticket title should always match what the user entered.
    const subject = rawSubject;

    const role = getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student';

    let attachmentUrl: string | null = null;
    if (attachment && attachment instanceof File && attachment.size > 0) {
      // Simple size guard (~5MB)
      if (attachment.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Attachment too large (max 5MB)' }, { status: 400 });
      }
      // Filesystem writes are not supported on Vercel. For now, ignore attachments.
      attachmentUrl = null;
    }

    const ticket = await createSupportTicket({
      userId: session.userId,
      role,
      subject,
      status: 'open',
    });

    const fullMessage = attachmentUrl
      ? `${message}\n\nAttachment: ${attachmentUrl}`
      : message;

    await addSupportMessage({
      ticketId: ticket.id,
      senderId: session.userId,
      senderRole: role,
      message: fullMessage,
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support-ticket]' });
  }
}


