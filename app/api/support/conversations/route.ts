import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAdmin as requireAdminResp } from '@/lib/auth/authorization';
import { getAllSupportConversations } from '@/lib/support/storage';
import { getUserById } from '@/lib/auth/storage';
import { handleApiError } from '@/lib/errorHandler';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const adminGate = requireAdminResp(session);
    if (adminGate) return adminGate;

    const conversations = await getAllSupportConversations();
    conversations.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    const enriched = await Promise.all(
      conversations.map(async (c) => {
        const user = await getUserById(c.userId);
        return {
          ...c,
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                profilePhotoUrl: (user as any).profilePhotoUrl || (user as any).profileImageUrl || null,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ conversations: enriched });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support/conversations]' });
  }
}



