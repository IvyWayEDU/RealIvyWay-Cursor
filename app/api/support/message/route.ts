import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAdmin as requireAdminResp } from '@/lib/auth/authorization';
import {
  appendSupportMessage,
  getOpenSupportConversationForUser,
  getOrCreateOpenSupportConversationForUser,
  getSupportConversationById,
  markSupportConversationRead,
  setSupportConversationStatus,
} from '@/lib/support/storage';
import { shouldEscalateByKeyword } from '@/lib/support/escalation';

type Action = 'send' | 'fetch' | 'markRead' | 'close';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const body = await request.json();
    const action: Action = (body?.action as Action) || 'send';

    const threadId: string | undefined = body?.threadId ? String(body.threadId) : undefined;
    const text: string | undefined = body?.text ? String(body.text).trim() : undefined;

    const isAdmin = Array.isArray(session.roles) && session.roles.includes('admin');

    // -------- User actions (default) --------
    if (!isAdmin) {
      if (action === 'fetch') {
        const convo = await getOpenSupportConversationForUser(session.userId);
        return NextResponse.json({ conversation: convo });
      }

      if (action === 'markRead') {
        const convo = threadId
          ? await getSupportConversationById(threadId)
          : await getOpenSupportConversationForUser(session.userId);
        if (!convo) return NextResponse.json({ conversation: null });
        if (convo.userId !== session.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const updated = await markSupportConversationRead({ conversationId: convo.id, reader: 'user' });
        return NextResponse.json({ conversation: updated });
      }

      if (!text) {
        return NextResponse.json({ error: 'Text is required' }, { status: 400 });
      }

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
    const adminGate = requireAdminResp(session);
    if (adminGate) return adminGate;

    if (action === 'fetch') {
      // Admins should use GET /api/support/conversations instead; keep this for completeness.
      return NextResponse.json({ error: 'Use /api/support/conversations' }, { status: 400 });
    }

    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
    }

    const convo = await getSupportConversationById(threadId);
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

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const updated = await appendSupportMessage({
      conversationId: convo.id,
      sender: 'admin',
      senderId: session.userId,
      text,
    });
    await markSupportConversationRead({ conversationId: updated.id, reader: 'admin' });
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error('Support message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



