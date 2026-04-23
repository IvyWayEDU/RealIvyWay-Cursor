/**
 * Student Sessions Page
 *
 * Mirrors provider sessions layout: Upcoming (left) + Completed (right).
 * Fetches sessions with role=student.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import ProviderSessionsClient from '@/components/ProviderSessionsClient';

export default async function StudentSessionsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  const isStudent = session.roles.includes('student');
  if (!isStudent) {
    redirect('/dashboard/sessions');
  }

  return (
    <div className="min-h-0">
      <ProviderSessionsClient role="student" />
    </div>
  );
}



