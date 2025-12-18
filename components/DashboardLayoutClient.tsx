'use client';

import Sidebar from './Sidebar';
import { Session } from '@/lib/auth/types';

type Role = 'student' | 'provider' | 'admin';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  session: Session;
  userRole: Role;
}

export default function DashboardLayoutClient({
  children,
  session,
  userRole,
}: DashboardLayoutClientProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar role={userRole} session={session} />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

