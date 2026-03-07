import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getDisplayRole } from '@/lib/auth/utils';
import { addSupportMessage, getSupportTicketById, setSupportTicketStatus } from '@/lib/support/ticketingStorage';

export async function POST(request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { ticketId } = await ctx.params;
    const id = String(ticketId || '').trim();
    if (!id) return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });

    const ticket = await getSupportTicketById(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');

    if (!isAdmin && ticket.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const senderRole = isAdmin ? 'admin' : (getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student');

    const msg = await addSupportMessage({
      ticketId: id,
      senderId: session.userId,
      senderRole,
      message,
    });

    if (isAdmin) {
      await setSupportTicketStatus(id, 'admin_replied');
    } else {
      // If user responds after an admin reply, bring ticket back to open.
      if (ticket.status === 'admin_replied') {
        await setSupportTicketStatus(id, 'open');
      }
    }

    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error('Support ticket message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


