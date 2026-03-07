import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAdmin as requireAdminResp } from '@/lib/auth/authorization';
import { getUserById } from '@/lib/auth/storage';
import { listSupportTickets } from '@/lib/support/ticketingStorage';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const url = new URL(request.url);
    const forAdmin = url.searchParams.get('admin') === '1' || url.searchParams.get('all') === '1';

    if (forAdmin) {
      const adminGate = requireAdminResp(session);
      if (adminGate) return adminGate;
    }

    const tickets = await listSupportTickets({
      forAdmin,
      userId: session.userId,
    });

    // Enrich user info for admin list UI
    const enriched = await Promise.all(
      tickets.map(async (t) => {
        const user = forAdmin ? await getUserById(t.userId) : null;
        return {
          ...t,
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

    return NextResponse.json({ tickets: enriched });
  } catch (error) {
    console.error('Support tickets list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


