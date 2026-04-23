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
    <div className="min-h-0">
      <AvailabilityManagementClient />
    </div>
  );
}
