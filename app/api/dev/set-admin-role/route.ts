import { setAdminRoleByEmail } from '@/lib/auth/setAdminRole';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errorHandler';
import { getServerSession } from '@/lib/auth/getServerSession';

/**
 * Set Admin Role API Route
 * 
 * Server-side utility endpoint to set admin role for a user by email.
 * Can be called once to set admin role for management@ivywayedu.com
 * 
 * Usage:
 *   POST /api/dev/set-admin-role
 *   Body: { "email": "management@ivywayedu.com" }
 * 
 * SECURITY: This route should be protected or only available in development
 */

export async function POST(request: Request) {
  try {
    // DEV-ONLY: never allow in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // SECURITY: require an admin session even in dev
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Call the utility function to set admin role
    const result = await setAdminRoleByEmail(email);

    if (result.success) {
      return NextResponse.json(
        { success: true, message: result.message },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/dev/set-admin-role]' });
  }
}



