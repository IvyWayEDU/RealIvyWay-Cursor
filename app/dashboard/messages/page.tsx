import MessagesClient from '@/components/MessagesClient';
import { getSession } from '@/lib/auth/session';
import { getDisplayRole } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';

/**
 * Messages Page
 * 
 * UI-only messaging interface for students and providers.
 * No real-time messaging or backend persistence.
 */

export default async function MessagesPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  const userRole = getDisplayRole(session.roles);
  const displayRole = userRole === 'student' ? 'student' : 'provider';

  return (
    <div className="min-h-0">
      <MessagesClient session={session} userRole={displayRole} />
    </div>
  );
}

