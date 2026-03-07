import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getDisplayRole } from '@/lib/auth/utils';
import {
  addSupportMessage,
  getOrCreateActiveSupportTicketForUser,
  getSupportTicketThread,
  setSupportTicketStatus,
} from '@/lib/support/ticketingStorage';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const body = await request.json().catch(() => ({}));
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const originalUserMessage =
      typeof body?.originalUserMessage === 'string' ? body.originalUserMessage.trim() : '';

    if (!subject) return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

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
    console.error('Support ticket create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


