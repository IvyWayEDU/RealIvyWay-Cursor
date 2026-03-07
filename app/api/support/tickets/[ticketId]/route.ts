import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAdmin as requireAdminResp } from '@/lib/auth/authorization';
import { getSupportTicketThread, setSupportTicketStatus } from '@/lib/support/ticketingStorage';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const { ticketId } = await ctx.params;
    const thread = await getSupportTicketThread(String(ticketId || '').trim());
    if (!thread) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');
    if (!isAdmin && thread.ticket.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Support ticket thread error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    console.error('Support ticket update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


