import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/getServerSession';
import { assignSupportConversation, getSupportConversationById } from '@/lib/support/storage';
import { handleApiError } from '@/lib/errorHandler';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const BodySchema = z.object({
      threadId: z.string().min(1).max(200),
      assignedAdminId: z.string().min(1).max(200).optional(),
    }).strict();
    const parsed = BodySchema.safeParse({
      threadId: typeof (body as any)?.threadId === 'string' ? (body as any).threadId.trim() : '',
      assignedAdminId: typeof (body as any)?.assignedAdminId === 'string' ? (body as any).assignedAdminId.trim() : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const threadId = parsed.data.threadId;
    const assignedAdminId = parsed.data.assignedAdminId ?? session.userId;

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
    return handleApiError(error, { logPrefix: '[api/support/assign]' });
  }
}



