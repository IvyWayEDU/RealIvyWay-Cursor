import DashboardLayoutClient from '@/components/DashboardLayoutClient';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDashboardRoute, getDisplayRole } from '@/lib/auth/utils';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify session exists
  const session = await getSession();
  
  if (!session) {
    // No session, redirect to login
    redirect('/auth/login');
  }

  // Get user's display role from session
  const userRole = getDisplayRole(session.roles);

  // Pass session data to client component
  return (
    <DashboardLayoutClient 
      session={session}
      userRole={userRole}
    >
      {children}
    </DashboardLayoutClient>
  );
}

