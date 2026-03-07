import DashboardLayoutClient from '@/components/DashboardLayoutClient';
import { getAuthContext, getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDashboardRoute, getDisplayRole } from '@/lib/auth/utils';
import { getUserById } from '@/lib/auth/storage';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthContext();
  if (auth.status === 'suspended') {
    redirect('/auth/login?error=suspended');
  }
  if (auth.status !== 'ok') {
    redirect('/auth/login');
  }

  // Verified session exists
  const session = auth.session;

  // Get user's display role from session
  const userRole = getDisplayRole(session.roles);
  const user = await getUserById(session.userId);
  const userProfilePhotoUrl =
    (user as any)?.profilePhotoUrl || (user as any)?.profileImageUrl || null;

  // Pass session data to client component
  return (
    <DashboardLayoutClient 
      session={session}
      userRole={userRole}
      userProfilePhotoUrl={userProfilePhotoUrl}
    >
      {children}
    </DashboardLayoutClient>
  );
}

