import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDisplayRole } from '@/lib/auth/utils';
import SupportCenterClient from './SupportCenterClient';

export default async function SupportPage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const displayRole = getDisplayRole(session.roles);
  const role = displayRole === 'provider' ? 'provider' : 'student';

  return (
    <SupportCenterClient
      role={role}
    />
  );
}


