import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAdmin as requireAdminResp } from '@/lib/auth/authorization';
import { getSupportTicketThread, markSupportTicketRead, setSupportTicketStatus } from '@/lib/support/ticketingStorage';
import { handleApiError } from '@/lib/errorHandler';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { ticketId } = await ctx.params;
    const id = String(ticketId || '').trim();
    const thread = await getSupportTicketThread(id);
    if (!thread) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');
    if (!isAdmin && thread.ticket.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Clear unread for the viewer when opening the ticket.
    try {
      await markSupportTicketRead(id, isAdmin ? 'admin' : 'user');
      const refreshed = await getSupportTicketThread(id);
      return NextResponse.json({ thread: refreshed ?? thread });
    } catch {
      return NextResponse.json({ thread });
    }
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/tickets/[ticketId]] GET' });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const adminGate = requireAdminResp(session);
    if (adminGate) return adminGate;

    const { ticketId } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const status = typeof body?.status === 'string' ? body.status.trim() : '';
    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const updated = await setSupportTicketStatus(String(ticketId || '').trim(), status);
    return NextResponse.json({ ticket: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/tickets/[ticketId]] PATCH' });
  }
}


