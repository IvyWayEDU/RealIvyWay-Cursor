import AdminStatisticsClient from '@/components/admin/AdminStatisticsClient';
import { getAdminStatistics } from '@/lib/admin/statistics.server';

export default async function AdminStatisticsPage() {
  const initial = await getAdminStatistics({ months: 12 });

  return <AdminStatisticsClient initial={initial} />;
}


