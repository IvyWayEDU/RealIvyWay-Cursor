import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import MySupportTicketsClient from './ticketsClient';

export default async function MySupportTicketsPage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');
  return <MySupportTicketsClient />;
}


