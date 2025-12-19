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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        <p className="mt-2 text-sm text-gray-600">
          {displayRole === 'student' 
            ? 'Chat with your tutors and counselors' 
            : 'Chat with your students'}
        </p>
      </div>

      {/* Messages Interface */}
      <MessagesClient session={session} userRole={displayRole} />
    </div>
  );
}
