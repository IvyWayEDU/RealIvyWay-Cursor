import { getSessions } from '@/lib/sessions/storage';
import AdminSessionsClient from '@/components/admin/AdminSessionsClient';

export default async function AdminSessionsPage() {
  const sessions = await getSessions();

  const sorted = [...sessions].sort((a: any, b: any) => {
    const aEnd = new Date(a?.scheduledEndTime || a?.endTime || a?.scheduledEnd || 0).getTime();
    const bEnd = new Date(b?.scheduledEndTime || b?.endTime || b?.scheduledEnd || 0).getTime();
    return (Number.isFinite(bEnd) ? bEnd : 0) - (Number.isFinite(aEnd) ? aEnd : 0);
  });

  return <AdminSessionsClient initialSessions={sorted as any} />;
}



