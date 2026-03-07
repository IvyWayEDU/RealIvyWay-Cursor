import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import AvailabilityManagementClient from '@/components/AvailabilityManagementClient';

export default async function AvailabilityPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  // Only providers can access this page
  if (!session.roles.includes('provider')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Availability</h1>
        <p className="mt-2 text-sm text-gray-600">
          Set your weekly availability for Sunday through Saturday.
        </p>
      </div>
      <AvailabilityManagementClient />
    </div>
  );
}
