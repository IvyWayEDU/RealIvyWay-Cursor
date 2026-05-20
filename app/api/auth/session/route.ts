import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/**
 * Minimal session endpoint for client UI.
 * Returns the server-verified session (roles from DB), or null when logged out.
 */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}

