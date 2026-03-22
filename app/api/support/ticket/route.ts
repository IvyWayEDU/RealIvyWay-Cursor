import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getDisplayRole } from '@/lib/auth/utils';
import {
  addSupportMessage,
  getOrCreateActiveSupportTicketForUser,
  getSupportTicketThread,
  setSupportTicketStatus,
} from '@/lib/support/ticketingStorage';
import { handleApiError } from '@/lib/errorHandler';
import { z } from 'zod';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/support/ticket',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const BodySchema = z.object({
      subject: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(140)),
      message: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(4000)),
      originalUserMessage: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(4000)).optional(),
    }).strict();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const { subject, message, originalUserMessage } = parsed.data;

    const role = getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student';
    const ticket = await getOrCreateActiveSupportTicketForUser({
      userId: session.userId,
      role,
      subject,
    });

    const combined = originalUserMessage
      ? `${message}\n\nOriginal user message:\n${originalUserMessage}`
      : message;

    await addSupportMessage({
      ticketId: ticket.id,
      senderId: session.userId,
      senderRole: role,
      message: combined,
    });

    // If user messages after an admin reply, bring ticket back to open.
    if (ticket.status === 'admin_replied') {
      await setSupportTicketStatus(ticket.id, 'open');
    }

    const thread = await getSupportTicketThread(ticket.id);
    return NextResponse.json({ thread });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/ticket]' });
  }
}


