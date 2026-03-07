import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getDisplayRole } from '@/lib/auth/utils';
import {
  addSupportMessage,
  getOrCreateActiveSupportTicketForUser,
  getSupportTicketThread,
  setSupportTicketStatus,
} from '@/lib/support/ticketingStorage';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const role = getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student';
    const ticket = await getOrCreateActiveSupportTicketForUser({
      userId: session.userId,
      role,
      subject: 'Support',
    });

    const thread = await getSupportTicketThread(ticket.id);
    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Support active ticket fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    const role = getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student';
    const ticket = await getOrCreateActiveSupportTicketForUser({
      userId: session.userId,
      role,
      subject: subject || 'Support',
    });

    await addSupportMessage({
      ticketId: ticket.id,
      senderId: session.userId,
      senderRole: role,
      message,
    });

    // If user messages after an admin reply, bring ticket back to open.
    if (ticket.status === 'admin_replied') {
      await setSupportTicketStatus(ticket.id, 'open');
    }

    const thread = await getSupportTicketThread(ticket.id);
    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Support active ticket send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


