import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import ChangePasswordClient from '@/components/ChangePasswordClient';

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }

  return <ChangePasswordClient />;
}

