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

  // Get full user data
  const user = await getUserById(session.userId);
  if (!user) {
    redirect('/auth/login');
  }

  const isProviderOrAdmin = session.roles.includes('provider') || session.roles.includes('admin');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your profile information and preferences.
        </p>
      </div>
      {isProviderOrAdmin ? (
        <ProviderProfileClient initialUser={user} />
      ) : (
        <StudentProfileClient initialUser={user} />
      )}
    </div>
  );
}
