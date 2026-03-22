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

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student';
    const ticket = await getOrCreateActiveSupportTicketForUser({
      userId: session.userId,
      role,
      subject: 'Support',
    });

    const thread = await getSupportTicketThread(ticket.id);
    return NextResponse.json({ thread });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/tickets/active] GET' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/support/tickets/active',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const BodySchema = z.object({
      message: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(4000)),
      subject: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(140)).optional(),
    }).strict();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const { message, subject } = parsed.data;

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
    return handleApiError(error, { logPrefix: '[api/support/tickets/active] POST' });
  }
}


