import AdminReconciliationClient from '@/components/admin/AdminReconciliationClient';
import { getAdminReconciliation } from '@/lib/admin/reconciliation.server';

export default async function AdminReconciliationPage() {
  const initial = await getAdminReconciliation({ days: 30 });
  return <AdminReconciliationClient initial={initial} />;
}

