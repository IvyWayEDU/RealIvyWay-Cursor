import { cookies } from 'next/headers';
import { Session, UserRole } from './types';
import { getUserById } from './storage';

const SESSION_COOKIE_NAME = 'ivyway_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSession(userId: string, email: string, name: string, roles: UserRole[]): Promise<void> {
  const cookieStore = await cookies();
  const session: Session = {
    userId,
    email,
    name,
    roles,
  };
  
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const session: Session = JSON.parse(sessionCookie.value);
    
    // Verify user still exists
    const user = await getUserById(session.userId);
    if (!user) {
      return null;
    }
    
    return session;
  } catch (error) {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

