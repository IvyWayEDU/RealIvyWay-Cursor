import { setAdminRoleByEmail } from '@/lib/auth/setAdminRole';
import { NextResponse } from 'next/server';

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
    console.error('[SET_ADMIN_ROLE API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to set admin role' 
      },
      { status: 500 }
    );
  }
}



