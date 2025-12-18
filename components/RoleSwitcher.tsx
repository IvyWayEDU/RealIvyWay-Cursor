'use client';

import { useRouter } from 'next/navigation';

type Role = 'student' | 'provider' | 'admin';

interface RoleSwitcherProps {
  currentRole: Role;
}

export default function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const router = useRouter();

  const roles: { value: Role; label: string }[] = [
    { value: 'student', label: 'Student' },
    { value: 'provider', label: 'Provider' },
    { value: 'admin', label: 'Admin' },
  ];

  const handleRoleChange = (role: Role) => {
    router.push(`/dashboard/${role}`);
  };

  return (
    <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <p className="mb-2 text-sm font-medium text-yellow-800">
        Development Mode: Role Switcher
      </p>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role.value}
            onClick={() => handleRoleChange(role.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentRole === role.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  );
}

