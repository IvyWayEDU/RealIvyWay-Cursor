import { getSessionsReadOnly } from '@/lib/sessions/storage';
import { getUsers } from '@/lib/auth/storage';
import AdminSessionsClient from '@/components/admin/AdminSessionsClient';

export default async function AdminSessionsPage() {
  const [sessions, users] = await Promise.all([getSessionsReadOnly(), getUsers()]);
  const userById = new Map<string, { email?: string | null; name?: string | null }>(
    (users || []).map((u: any) => [String(u?.id || ''), { email: u?.email ?? null, name: u?.name ?? null }])
  );

  const sorted = [...sessions].sort((a: any, b: any) => {
    const aEnd = new Date(a?.scheduledEndTime || a?.endTime || a?.scheduledEnd || 0).getTime();
    const bEnd = new Date(b?.scheduledEndTime || b?.endTime || b?.scheduledEnd || 0).getTime();
    return (Number.isFinite(bEnd) ? bEnd : 0) - (Number.isFinite(aEnd) ? aEnd : 0);
  });

  const enriched = sorted.map((s: any) => {
    const student = userById.get(String(s?.studentId || s?.student_id || '')) || null;
    const provider = userById.get(String(s?.providerId || s?.provider_id || '')) || null;
    return {
      ...s,
      studentEmail:
        (typeof s?.studentEmail === 'string' && s.studentEmail) ||
        (typeof s?.student_email === 'string' && s.student_email) ||
        (typeof student?.email === 'string' ? student.email : undefined),
      providerEmail:
        (typeof s?.providerEmail === 'string' && s.providerEmail) ||
        (typeof s?.provider_email === 'string' && s.provider_email) ||
        (typeof provider?.email === 'string' ? provider.email : undefined),
    };
  });

  return <AdminSessionsClient initialSessions={enriched as any} />;
}



