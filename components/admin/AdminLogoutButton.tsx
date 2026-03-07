'use client';

import { logout } from '@/lib/auth/actions';

export default function AdminLogoutButton() {
  return (
    <button
      onClick={async () => {
        await logout();
      }}
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      Logout
    </button>
  );
}



