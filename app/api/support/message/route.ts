import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { handleApiError } from '@/lib/errorHandler';
import {
  appendSupportMessage,
  getOpenSupportConversationForUser,
  getOrCreateOpenSupportConversationForUser,
  getSupportConversationById,
  markSupportConversationRead,
  setSupportConversationStatus,
} from '@/lib/support/storage';
import { shouldEscalateByKeyword } from '@/lib/support/escalation';
import { validateRequestBody } from '@/lib/validation/utils';
import { supportChatRequestSchema } from '@/lib/validation/schemas';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/support/message',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const validationResult = await validateRequestBody(request, supportChatRequestSchema);
    if (!validationResult.success) return validationResult.response;

    // Even with schema validation, guard request-body fields at runtime so TS builds never
    // fail due to overly-broad inferred types (e.g. `{}`) from validation helpers.
    const body = validationResult.data as {
      action?: unknown;
      threadId?: unknown;
      text?: unknown;
    };

    const action = typeof body.action === 'string' ? body.action : 'send';
    const threadId =
      typeof body.threadId === 'string' || typeof body.threadId === 'number'
        ? String(body.threadId).trim()
        : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');

    // -------- User actions (default) --------
    if (!isAdmin) {
      if (action === 'fetch') {
        const convo = await getOpenSupportConversationForUser(session.userId);
        return NextResponse.json({ conversation: convo });
      }

      if (action === 'markRead') {
        const convo = threadId
          ? await getSupportConversationById(String(threadId))
          : await getOpenSupportConversationForUser(session.userId);
        if (!convo) return NextResponse.json({ conversation: null });
        if (convo.userId !== session.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const updated = await markSupportConversationRead({ conversationId: convo.id, reader: 'user' });
        return NextResponse.json({ conversation: updated });
      }

      // send
      if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

      const convo = await getOrCreateOpenSupportConversationForUser(session.userId);
      const updated = await appendSupportMessage({
        conversationId: convo.id,
        sender: 'user',
        senderId: session.userId,
        text,
      });
      await markSupportConversationRead({ conversationId: updated.id, reader: 'user' });

      // If user explicitly asks for escalation, this endpoint is the human-support rail already.
      const userEscalated = shouldEscalateByKeyword(text);
      return NextResponse.json({ conversation: updated, userEscalated });
    }

    // -------- Admin actions --------
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'fetch') {
      // Admins should use GET /api/support/conversations instead; keep this for completeness.
      return NextResponse.json({ error: 'Use /api/support/conversations' }, { status: 400 });
    }

    if (!threadId) return NextResponse.json({ error: 'threadId is required' }, { status: 400 });

    const convo = await getSupportConversationById(String(threadId));
    if (!convo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (action === 'close') {
      const updated = await setSupportConversationStatus(convo.id, 'closed');
      return NextResponse.json({ conversation: updated });
    }

    if (action === 'markRead') {
      const updated = await markSupportConversationRead({ conversationId: convo.id, reader: 'admin' });
      return NextResponse.json({ conversation: updated });
    }

    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

    const updated = await appendSupportMessage({
      conversationId: convo.id,
      sender: 'admin',
      senderId: session.userId,
      text,
    });
    await markSupportConversationRead({ conversationId: updated.id, reader: 'admin' });
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/message]' });
  }
}



