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
    const studentId = String(s?.studentId || s?.student_id || '').trim();
    const providerId = String(s?.providerId || s?.provider_id || '').trim();
    const student = (studentId && userById.get(studentId)) || null;
    const provider = (providerId && userById.get(providerId)) || null;
    return {
      ...s,
      studentName:
        (typeof student?.name === 'string' && student.name.trim() ? student.name.trim() : undefined) ||
        (typeof s?.studentName === 'string' && s.studentName.trim() ? s.studentName.trim() : undefined) ||
        (typeof s?.student_name === 'string' && String(s.student_name).trim() ? String(s.student_name).trim() : undefined),
      providerName:
        (typeof provider?.name === 'string' && provider.name.trim() ? provider.name.trim() : undefined) ||
        (typeof s?.providerName === 'string' && s.providerName.trim() ? s.providerName.trim() : undefined) ||
        (typeof s?.provider_name === 'string' && String(s.provider_name).trim() ? String(s.provider_name).trim() : undefined),
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



