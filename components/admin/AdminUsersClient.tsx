'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type UserRow = {
  id: string;
  name?: string;
  email?: string;
  roles?: string[];
  role?: string;
  userRole?: string;
  status?: 'active' | 'suspended';
  isSuspended?: boolean;
  services?: string[];
  serviceTypes?: string[];
  profile?: any;
  schoolId?: string;
  schoolName?: string;
  [key: string]: any;
};

function displayRole(roles: unknown): 'student' | 'provider' | 'admin' | 'unknown' {
  if (!Array.isArray(roles)) return 'unknown';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('student')) return 'student';
  if (roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor')) return 'provider';
  return 'unknown';
}

type UsersFilter = 'all' | 'students' | 'providers' | 'tutors' | 'counselors';

function getRoleField(u: any): string | null {
  if (!u) return null;
  if (Array.isArray(u?.roles)) return null; // caller should check roles[] first
  if (typeof u?.role === 'string' && u.role.trim()) return u.role.trim();
  if (typeof u?.userRole === 'string' && u.userRole.trim()) return u.userRole.trim();
  return null;
}

function hasRole(u: any, role: string): boolean {
  if (!u) return false;
  if (Array.isArray(u?.roles)) return u.roles.includes(role);
  const r = getRoleField(u);
  return r === role;
}

function getServices(u: any): string[] {
  const raw: unknown = u?.services ?? u?.serviceTypes ?? u?.profile?.serviceTypes ?? u?.profile?.services;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const s of raw) {
    if (typeof s === 'string' && s.trim()) out.push(s.trim());
  }
  return out;
}

type AdminUserStats = {
  totalUsers: number;
  studentCount: number;
  providerCount: number;
  tutorCount: number;
  counselorCount: number;
  schoolStats: { schoolIdNormalized: string; schoolName: string; providerCount: number }[];
};

export default function AdminUsersClient(props: { initialUsers: UserRow[]; stats: AdminUserStats }) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(props.initialUsers || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<UsersFilter>('all');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const roleFiltered =
      selectedFilter === 'all'
        ? users
        : selectedFilter === 'students'
          ? users.filter((u) => hasRole(u, 'student'))
          : selectedFilter === 'providers'
            ? users.filter((u) => hasRole(u, 'provider'))
            : selectedFilter === 'tutors'
              ? users.filter((u) => {
                  if (!hasRole(u, 'provider')) return false;
                  const services = getServices(u);
                  return services.includes('tutoring') || services.includes('testprep') || services.includes('test_prep');
                })
              : selectedFilter === 'counselors'
                ? users.filter((u) => {
                    if (!hasRole(u, 'provider')) return false;
                    const services = getServices(u);
                    return services.includes('college_counseling') || services.includes('virtual_tour');
                  })
                : users;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return roleFiltered;

    return roleFiltered.filter((u) => {
      const name = String(u?.name || '').toLowerCase();
      const email = String(u?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, searchQuery, selectedFilter]);

  const hasActiveSearch = searchQuery.trim().length > 0;

  async function post(path: string, body: any) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
  }

  const schoolRows = useMemo(() => {
    const rows = Array.isArray(props.stats?.schoolStats) ? props.stats.schoolStats : [];
    return rows
      .map((r) => ({
        schoolIdNormalized: String(r?.schoolIdNormalized || '').trim(),
        schoolName: typeof r?.schoolName === 'string' ? r.schoolName.trim() : '',
        providerCount: Number(r?.providerCount || 0),
      }))
      .filter((r) => !!r.schoolIdNormalized && !!r.schoolName)
      .sort((a, b) => {
        const diff = b.providerCount - a.providerCount;
        if (diff !== 0) return diff;
        return a.schoolName.localeCompare(b.schoolName);
      });
  }, [props.stats]);

  const filteredSchoolRows = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schoolRows;
    return schoolRows.filter((r) => r.schoolName.toLowerCase().includes(q));
  }, [schoolQuery, schoolRows]);

  async function suspend(userId: string) {
    setWorkingId(userId);
    setError(null);
    try {
      const data = await post('/api/admin/users/suspend', { userId });
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to suspend user');
    } finally {
      setWorkingId(null);
    }
  }

  async function unsuspend(userId: string) {
    setWorkingId(userId);
    setError(null);
    try {
      const data = await post('/api/admin/users/unsuspend', { userId });
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unsuspend user');
    } finally {
      setWorkingId(null);
    }
  }

  async function changeRole(userId: string, role: 'student' | 'provider') {
    setWorkingId(userId);
    setError(null);
    try {
      const data = await post('/api/admin/users/change-role', { userId, role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change role');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="mt-2 text-sm text-gray-600">Manage users, roles, and account status.</p>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border-t-4 border-indigo-600 bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">TOTAL USERS</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{props.stats.totalUsers}</div>
        </div>
        <div className="rounded-lg border-t-4 border-indigo-600 bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">STUDENTS</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{props.stats.studentCount}</div>
        </div>
        <div className="rounded-lg border-t-4 border-indigo-600 bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">TOTAL PROVIDERS</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{props.stats.providerCount}</div>
        </div>
        <div className="rounded-lg border-t-4 border-indigo-600 bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">TUTORS</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{props.stats.tutorCount}</div>
        </div>
        <div className="rounded-lg border-t-4 border-indigo-600 bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">COUNSELORS</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{props.stats.counselorCount}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Provider Schools</div>
            <div className="mt-1 text-xs text-gray-500">Deduplicated by normalized school id.</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-56">
              <input
                value={schoolQuery}
                onChange={(e) => setSchoolQuery(e.target.value)}
                placeholder="Search schools"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="text-sm text-gray-500">
              {filteredSchoolRows.length}
              {schoolQuery.trim() ? ` / ${schoolRows.length}` : ''}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">School Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Providers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredSchoolRows.map((row) => (
                <tr key={row.schoolIdNormalized}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.schoolName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{row.providerCount}</td>
                </tr>
              ))}
              {schoolRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm text-gray-600">
                    No provider schools found.
                  </td>
                </tr>
              )}
              {schoolRows.length > 0 && filteredSchoolRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm text-gray-600">
                    No schools match “{schoolQuery.trim()}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">All Users</div>
          <div className="flex items-center gap-3">
            <div className="w-72">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="inline-flex rounded-full bg-gray-100 p-1">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'students', label: 'Students' },
                  { key: 'providers', label: 'Providers' },
                  { key: 'tutors', label: 'Tutors' },
                  { key: 'counselors', label: 'Counselors' },
                ] as const
              ).map((opt) => {
                const active = selectedFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedFilter(opt.key)}
                    aria-pressed={active}
                    className={[
                      'px-3 py-1.5 text-xs font-semibold rounded-full transition-colors',
                      active ? 'bg-[#0088CB] text-white shadow-sm' : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="text-sm text-gray-500">{filteredUsers.length} shown</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Rating</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.map((u) => {
                const role = displayRole(u.roles);
                const isSuspended = Boolean(u.isSuspended) || u.status === 'suspended';
                const status: 'active' | 'suspended' = isSuspended ? 'suspended' : 'active';
                const busy = workingId === u.id;
                const rating = role === 'provider' ? '—' : '—';
                return (
                  <tr key={u.id} className={busy ? 'opacity-70' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                          role === 'admin'
                            ? 'bg-indigo-100 text-indigo-800'
                            : role === 'provider'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800',
                        ].join(' ')}
                      >
                        {role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                          status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
                        ].join(' ')}
                      >
                        {status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{rating}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/users/${encodeURIComponent(u.id)}`}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          View
                        </Link>

                        {status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => suspend(u.id)}
                            disabled={busy || role === 'admin'}
                            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            title={role === 'admin' ? 'Cannot suspend admin via UI' : ''}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => unsuspend(u.id)}
                            disabled={busy}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Unsuspend
                          </button>
                        )}

                        {role !== 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => changeRole(u.id, 'student')}
                              disabled={busy}
                              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Make student
                            </button>
                            <button
                              type="button"
                              onClick={() => changeRole(u.id, 'provider')}
                              disabled={busy}
                              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Make provider
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                    {hasActiveSearch ? 'No users found matching your search.' : 'No users found for this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


