import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAdmin as requireAdminResp } from '@/lib/auth/authorization';
import { assignSupportConversation, getSupportConversationById } from '@/lib/support/storage';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const adminGate = requireAdminResp(session);
    if (adminGate) return adminGate;

    const body = await request.json();
    const threadId: string = String(body?.threadId ?? '').trim();
    const assignedAdminId: string | undefined = body?.assignedAdminId
      ? String(body.assignedAdminId).trim()
      : session.userId;

    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
    }

    const convo = await getSupportConversationById(threadId);
    if (!convo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const updated = await assignSupportConversation(threadId, assignedAdminId || undefined);
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error('Support assign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



