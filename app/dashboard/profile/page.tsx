import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/auth/storage';
import ProviderProfileClient from '@/components/ProviderProfileClient';
import StudentProfileClient from '@/components/StudentProfileClient';

export default async function ProfilePage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  if (!Array.isArray(session.roles) || session.roles.length === 0) {
    redirect('/onboarding/role');
  }

  // Get full user data
  const user = await getUserById(session.userId);
  if (!user) {
    redirect('/auth/login');
  }

  const isProviderOrAdmin = session.roles.includes('provider') || session.roles.includes('admin');

  return (
    <div className="min-h-0">
      {isProviderOrAdmin ? (
        <ProviderProfileClient initialUser={user} />
      ) : (
        <StudentProfileClient initialUser={user} />
      )}
    </div>
  );
}
