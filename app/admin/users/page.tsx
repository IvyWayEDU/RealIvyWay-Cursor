import { getUsers } from '@/lib/auth/storage';
import AdminUsersClient from '@/components/admin/AdminUsersClient';

export default async function AdminUsersPage() {
  const users = await getUsers();

  const allUsers = Array.isArray(users) ? (users as any[]) : [];

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

  function normalizeSchoolIdFromId(rawId: string): string {
    return rawId
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function normalizeSchoolIdFromName(rawName: string): string {
    return rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function normalizeSchoolNameDisplay(rawName: string): string {
    return rawName.trim().replace(/\s+/g, ' ');
  }

  function getProviderSchoolFields(provider: any): { schoolName: string | null; schoolId: string | null } {
    const profile = provider?.profile;

    // 1) provider.profile.schoolName + provider.profile.schoolId
    const p1Name =
      (typeof profile?.schoolName === 'string' && profile.schoolName.trim()) ||
      (typeof profile?.school_name === 'string' && profile.school_name.trim()) ||
      null;
    const p1Id =
      (typeof profile?.schoolId === 'string' && profile.schoolId.trim()) ||
      (typeof profile?.school_id === 'string' && profile.school_id.trim()) ||
      null;
    if (p1Name) return { schoolName: String(p1Name), schoolId: p1Id ? String(p1Id) : null };

    // 2) provider.schoolName + provider.schoolId
    const p2Name =
      (typeof provider?.school_name === 'string' && provider.school_name.trim()) ||
      (typeof provider?.schoolName === 'string' && provider.schoolName.trim()) ||
      null;
    const p2Id =
      (typeof provider?.school_id === 'string' && provider.school_id.trim()) ||
      (typeof provider?.schoolId === 'string' && provider.schoolId.trim()) ||
      null;
    if (p2Name) return { schoolName: String(p2Name), schoolId: p2Id ? String(p2Id) : null };

    // 3) provider.school + provider.schoolId
    const p3Name = typeof provider?.school === 'string' && provider.school.trim() ? provider.school.trim() : null;
    const p3Id =
      (typeof provider?.schoolId === 'string' && provider.schoolId.trim()) ||
      (typeof provider?.school_id === 'string' && provider.school_id.trim()) ||
      null;
    if (p3Name) return { schoolName: String(p3Name), schoolId: p3Id ? String(p3Id) : null };

    // 4) provider.collegeName + provider.collegeId
    const p4Name =
      (typeof provider?.collegeName === 'string' && provider.collegeName.trim()) ||
      (typeof provider?.college_name === 'string' && provider.college_name.trim()) ||
      null;
    const p4Id =
      (typeof provider?.collegeId === 'string' && provider.collegeId.trim()) ||
      (typeof provider?.college_id === 'string' && provider.college_id.trim()) ||
      null;
    if (p4Name) return { schoolName: String(p4Name), schoolId: p4Id ? String(p4Id) : null };

    return { schoolName: null, schoolId: null };
  }

  const totalUsers = allUsers.length;
  const studentCount = allUsers.filter((u) => hasRole(u, 'student')).length;

  const providerUsers = allUsers.filter((u) => hasRole(u, 'provider'));
  const providerCount = providerUsers.length;

  const tutorCount = providerUsers.filter((u) => {
    const services = getServices(u);
    return services.includes('tutoring') || services.includes('test_prep');
  }).length;

  const counselorCount = providerUsers.filter((u) => {
    const services = getServices(u);
    return services.includes('college_counseling') || services.includes('virtual_tour');
  }).length;

  const schoolAgg = new Map<string, { schoolIdNormalized: string; schoolName: string; providerCount: number }>();
  for (const provider of providerUsers) {
    const { schoolName, schoolId } = getProviderSchoolFields(provider);
    if (!schoolName) continue;

    const schoolNameNormalized = normalizeSchoolNameDisplay(schoolName);
    if (!schoolNameNormalized) continue;

    const schoolIdNormalized = schoolId ? normalizeSchoolIdFromId(schoolId) : normalizeSchoolIdFromName(schoolNameNormalized);
    if (!schoolIdNormalized) continue;

    const existing = schoolAgg.get(schoolIdNormalized);
    if (!existing) {
      schoolAgg.set(schoolIdNormalized, {
        schoolIdNormalized,
        schoolName: schoolNameNormalized,
        providerCount: 1,
      });
      continue;
    }

    const nextName = schoolNameNormalized.length > existing.schoolName.length ? schoolNameNormalized : existing.schoolName;
    schoolAgg.set(schoolIdNormalized, { ...existing, schoolName: nextName, providerCount: existing.providerCount + 1 });
  }

  const schoolStats = Array.from(schoolAgg.values()).sort((a, b) => {
    const diff = b.providerCount - a.providerCount;
    if (diff !== 0) return diff;
    return a.schoolName.localeCompare(b.schoolName);
  });

  return (
    <AdminUsersClient
      initialUsers={users as any}
      stats={{
        totalUsers,
        studentCount,
        providerCount,
        tutorCount,
        counselorCount,
        schoolStats,
      }}
    />
  );
}


