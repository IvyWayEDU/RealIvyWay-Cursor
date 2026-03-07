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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
        <p className="mt-2 text-sm text-gray-600">
          View your upcoming and completed sessions.
        </p>
      </div>
      <ProviderSessionsClient role="student" />
    </div>
  );
}



