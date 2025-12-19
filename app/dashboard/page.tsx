/**
 * Dashboard Home
 * 
 * Redirects to role-specific dashboard home route.
 * This page should not be accessed directly - users should be redirected
 * to their role-specific dashboard (/dashboard/student or /dashboard/provider).
 */

import { getSession } from '@/lib/auth/session';
import { getDashboardRoute } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';

export default async function DashboardHome() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  // Redirect to role-specific dashboard
  const dashboardRoute = getDashboardRoute(session.roles);
  redirect(dashboardRoute);
}
