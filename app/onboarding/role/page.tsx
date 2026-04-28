import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDashboardRoute } from '@/lib/auth/utils';
import RoleSelectionClient from '@/components/RoleSelectionClient';

export default async function RoleOnboardingPage() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }

  // If role already chosen, do not allow returning here.
  if (Array.isArray(session.roles) && session.roles.length > 0) {
    redirect(getDashboardRoute(session.roles));
  }

  return <RoleSelectionClient />;
}

