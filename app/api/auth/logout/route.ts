import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errorHandler';

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/auth/logout]' });
  }
}


