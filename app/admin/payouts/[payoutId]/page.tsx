import Link from 'next/link';
import { getPayoutRequestById } from '@/lib/payouts/payout-requests.server';
import { getUserById } from '@/lib/auth/storage';
import { getProviderByUserId } from '@/lib/providers/storage';
import { normalizePayoutMethod, payoutMethodLabel } from '@/lib/payouts/payout-snapshot';
import { getAdminPayoutPaymentTimeline } from '@/lib/admin/payment-timeline.server';
import PaymentTimeline from '@/components/admin/PaymentTimeline';
import { getSessionById } from '@/lib/sessions/storage';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDateTime(iso: unknown): string {
  const s = typeof iso === 'string' ? iso : '';
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function last4(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length < 4) return '—';
  return v.slice(-4);
}

export default async function AdminPayoutRecordPage(props: { params: { payoutId: string } }) {
  const { payoutId } = props.params;
  const payoutRequestId = String(payoutId || '').trim();

  const pr = payoutRequestId ? await getPayoutRequestById(payoutRequestId) : null;
  const payoutTimeline = payoutRequestId ? await getAdminPayoutPaymentTimeline(payoutRequestId) : null;
  if (!pr) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payout Record</h1>
            <p className="mt-1 text-sm text-gray-600">Payout request not found.</p>
          </div>
          <Link href="/admin/payouts" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            Back to Payouts
          </Link>
        </div>
      </div>
    );
  }

  const providerId = String(pr.providerId || '').trim();
  const [providerUser, providerProfile] = await Promise.all([
    providerId ? getUserById(providerId) : Promise.resolve(null),
    providerId ? getProviderByUserId(providerId) : Promise.resolve(null),
  ]);

  const methodNorm = normalizePayoutMethod(pr.payoutMethod) || normalizePayoutMethod((providerProfile as any)?.payoutMethod);
  const payoutMethod = payoutMethodLabel(methodNorm) || (typeof pr.payoutMethod === 'string' ? pr.payoutMethod : '') || '—';

  const bankName =
    methodNorm === 'bank'
      ? (typeof pr.bankName === 'string' && pr.bankName.trim()) || (typeof (providerProfile as any)?.bankName === 'string' && (providerProfile as any).bankName.trim())
      : '';
  const bankAccountNumber =
    methodNorm === 'bank'
      ? (typeof pr.bankAccountNumber === 'string' && pr.bankAccountNumber.trim()) ||
        (typeof (providerProfile as any)?.bankAccountNumber === 'string' && (providerProfile as any).bankAccountNumber.trim())
      : '';

  const providerName = providerUser?.name || providerUser?.email || providerId || '—';
  const providerEmail = providerUser?.email || '—';

  const allocations = payoutTimeline?.allocations || [];
  const allocationSessions = await Promise.all(
    allocations
      .filter((a) => a.sessionId && a.sessionId !== '__unattributed__')
      .map(async (a) => {
        const s = await getSessionById(a.sessionId);
        const ss: any = s as any;
        return {
          sessionId: a.sessionId,
          amountCents: a.amountCents,
          label:
            s
              ? `${ss?.studentName || ss?.studentId || 'Student'} → ${ss?.providerName || ss?.providerId || 'Provider'}`
              : a.sessionId,
          scheduledStartTime: s ? (ss?.scheduledStartTime || ss?.startTime || '') : '',
        };
      })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payout Record</h1>
          <div className="mt-2 text-sm text-gray-600 font-mono break-all">{pr.id}</div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="#payment-timeline"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            View Payment Timeline
          </Link>
          <Link href="/admin/payouts" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            Back to Payouts
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="text-lg font-semibold text-gray-900">Details</div>
          <div className="mt-1 text-sm text-gray-600">Admin-only payout record summary for support workflows.</div>
        </div>

        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-gray-500">Provider Name</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{providerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Provider Email</dt>
              <dd className="mt-1 text-sm text-gray-900 break-all">{providerEmail}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Payout Amount</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(Number(pr.amountCents || 0))}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{String(pr.status || '—')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Payout Method</dt>
              <dd className="mt-1 text-sm text-gray-900">{payoutMethod}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Bank Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{bankName ? String(bankName) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Last 4 Digits</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{bankAccountNumber ? last4(bankAccountNumber) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Requested Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDateTime(pr.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500">Paid Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDateTime(pr.paidAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div id="payment-timeline" className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="text-lg font-semibold text-gray-900">Payment Timeline</div>
          <div className="mt-1 text-sm text-gray-600">Audit trail for this payout request.</div>
        </div>
        <div className="px-6 py-5 space-y-6">
          <PaymentTimeline
            events={payoutTimeline?.events || []}
            emptyText="No payout timeline events found for this record yet."
          />

          {allocations.length ? (
            <div className="border-t border-gray-200 pt-5">
              <div className="text-sm font-semibold text-gray-900">Bookings included</div>
              <div className="mt-3 space-y-2">
                {allocationSessions.map((a) => (
                  <div key={`${a.sessionId}-${a.amountCents}`} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/admin/sessions/${a.sessionId}`} className="text-sm font-medium text-indigo-700 hover:underline break-all">
                        {a.label}
                      </Link>
                      {a.scheduledStartTime ? (
                        <div className="mt-0.5 text-xs text-gray-500">
                          Scheduled: {formatDateTime(a.scheduledStartTime)}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-gray-900">{money(a.amountCents)}</div>
                  </div>
                ))}
                {allocations.some((a) => a.sessionId === '__unattributed__') ? (
                  <div className="text-xs text-amber-700">
                    Some amount is marked <span className="font-semibold">unattributed</span> due to legacy payout data.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

