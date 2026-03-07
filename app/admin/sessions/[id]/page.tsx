import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionById } from '@/lib/sessions/storage';
import ForceCompleteSessionTestButton from '@/components/admin/ForceCompleteSessionTestButton';

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return notFound();

  const s: any = session as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session Detail</h1>
          <div className="mt-1 text-sm text-gray-600 font-mono break-all">{s.id}</div>
        </div>
        <Link
          href="/admin/sessions"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to Sessions
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Status section (button lives here per requirements) */}
        <div className="bg-white shadow rounded-lg overflow-hidden lg:col-span-1">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Current Status</div>
              <div className="text-base font-semibold text-gray-900">{String(s.status || 'unknown')}</div>
            </div>

            {s.completed_by_admin_test && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Completed by admin test override.
              </div>
            )}

            <ForceCompleteSessionTestButton sessionId={s.id} sessionStatus={s.status} />
          </div>
        </div>

        {/* Details */}
        <div className="bg-white shadow rounded-lg overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Student</div>
                <div className="mt-1 text-sm text-gray-900">{s.studentName || s.studentId}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Provider</div>
                <div className="mt-1 text-sm text-gray-900">{s.providerName || s.providerId}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Service</div>
                <div className="mt-1 text-sm text-gray-900">{s.serviceType || s.service_type || s.serviceTypeId || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Subject / Topic</div>
                <div className="mt-1 text-sm text-gray-900">
                  {(() => {
                    const subject =
                      typeof s.subject === 'string' && s.subject.trim() ? s.subject.trim() : '';
                    const topic =
                      typeof s.topic === 'string' && s.topic.trim() ? s.topic.trim() : '';
                    if (subject && topic) return `${subject} — ${topic}`;
                    return subject || topic || '—';
                  })()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Scheduled Start</div>
                <div className="mt-1 text-sm text-gray-900">{s.scheduledStartTime}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Scheduled End</div>
                <div className="mt-1 text-sm text-gray-900">{s.scheduledEndTime}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Completed At</div>
                <div className="mt-1 text-sm text-gray-900">{s.completedAt || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Completion Reason</div>
                <div className="mt-1 text-sm text-gray-900">{s.completionReason || '—'}</div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">Payout / Earnings</h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">providerPayoutCents</div>
                  <div className="mt-1 text-sm text-gray-900">{String(s.providerPayoutCents ?? '—')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">platformFeeCents</div>
                  <div className="mt-1 text-sm text-gray-900">{String(s.platformFeeCents ?? '—')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">payoutStatus</div>
                  <div className="mt-1 text-sm text-gray-900">{String(s.payoutStatus ?? '—')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">providerPayoutAmount</div>
                  <div className="mt-1 text-sm text-gray-900">{String(s.providerPayoutAmount ?? '—')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



