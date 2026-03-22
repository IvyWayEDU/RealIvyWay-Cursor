import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { getDisplayRole } from '@/lib/auth/utils';
import { addSupportMessage, getSupportTicketById, setSupportTicketStatus } from '@/lib/support/ticketingStorage';
import { handleApiError } from '@/lib/errorHandler';
import { validateRequestBody } from '@/lib/validation/utils';
import { supportTicketMessageSchema } from '@/lib/validation/schemas';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export async function POST(request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/support/tickets/[ticketId]/messages',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const { ticketId } = await ctx.params;
    const id = String(ticketId || '').trim();
    if (!id) return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });

    const ticket = await getSupportTicketById(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const validationResult = await validateRequestBody(request, supportTicketMessageSchema);
    if (!validationResult.success) return validationResult.response;
    const { message } = validationResult.data;

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
      // Only flip to "admin_replied" when the ticket isn't already resolved/closed.
      if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
        await setSupportTicketStatus(id, 'admin_replied');
      }
    } else {
      // If user responds after an admin reply (or after a resolution), bring ticket back to open.
      if (ticket.status === 'admin_replied' || ticket.status === 'resolved') {
        await setSupportTicketStatus(id, 'open');
      }
    }

    return NextResponse.json({ message: msg });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/tickets/[ticketId]/messages]' });
  }
}


