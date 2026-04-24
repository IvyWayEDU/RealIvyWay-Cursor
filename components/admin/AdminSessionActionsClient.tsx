'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  sessionId: string;
  currentStatus: string;
  providerId?: string | null;
  studentId?: string | null;
  stripePaymentIntentId?: string | null;
  disputeId?: string | null;
};

type ApiResponse = Record<string, any>;

async function post(path: string, body: any): Promise<ApiResponse> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResponse;
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
  return data;
}

function normalizeStatus(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

function dollarsToCents(input: string): number | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

export default function AdminSessionActionsClient(props: Props) {
  const router = useRouter();
  const sessionId = props.sessionId;

  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Status override
  const [status, setStatus] = useState<string>(normalizeStatus(props.currentStatus) || 'confirmed');
  const [statusNote, setStatusNote] = useState<string>('');

  // Refund
  const [refundAmountDollars, setRefundAmountDollars] = useState<string>(''); // empty = full remaining
  const [refundReason, setRefundReason] = useState<string>('requested_by_customer');
  const [refundNote, setRefundNote] = useState<string>('');

  // Reassign provider
  const [newProviderId, setNewProviderId] = useState<string>('');
  const [reassignNote, setReassignNote] = useState<string>('');

  // Dispute
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeNote, setDisputeNote] = useState<string>('');
  const [disputeResolution, setDisputeResolution] = useState<string>('');
  const [disputeOutcomeStatus, setDisputeOutcomeStatus] = useState<string>('confirmed');

  const hasStripePayment = useMemo(() => Boolean(props.stripePaymentIntentId && props.stripePaymentIntentId.trim()), [props.stripePaymentIntentId]);
  const hasDispute = useMemo(() => Boolean(props.disputeId && String(props.disputeId).trim()), [props.disputeId]);

  async function run(label: string, fn: () => Promise<void>) {
    setWorking(label);
    setError(null);
    setOk(null);
    try {
      await fn();
      setOk('Saved.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setWorking(null);
      window.setTimeout(() => setOk((v) => (v ? null : v)), 2500);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {ok ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="text-sm font-semibold text-gray-900">Session overrides</div>
          <div className="mt-1 text-xs text-gray-500">Update status, issue refunds, reassign provider, and manage disputes.</div>
        </div>
        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-gray-500">Set session status</div>
              <div className="mt-2 space-y-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="scheduled">scheduled</option>
                  <option value="confirmed">confirmed</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                  <option value="provider_no_show">provider_no_show</option>
                  <option value="student_no_show">student_no_show</option>
                  <option value="disputed">disputed</option>
                  <option value="refunded">refunded</option>
                </select>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Admin note (recommended)"
                  className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() =>
                    run('set-status', async () => {
                      await post('/api/admin/sessions/set-status', { sessionId, status, note: statusNote });
                    })
                  }
                  className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Update status
                </button>
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-gray-500">Manual refund (Stripe)</div>
              <div className="mt-2 space-y-2">
                <input
                  value={refundAmountDollars}
                  onChange={(e) => setRefundAmountDollars(e.target.value)}
                  placeholder="Amount in dollars (blank = full remaining)"
                  disabled={!hasStripePayment || working !== null}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={!hasStripePayment || working !== null}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                >
                  <option value="requested_by_customer">requested_by_customer</option>
                  <option value="duplicate">duplicate</option>
                  <option value="fraudulent">fraudulent</option>
                </select>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="Refund note (internal)"
                  disabled={!hasStripePayment || working !== null}
                  className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!hasStripePayment || working !== null}
                  onClick={() =>
                    run('refund', async () => {
                      const cents = dollarsToCents(refundAmountDollars);
                      await post('/api/admin/sessions/refund', {
                        sessionId,
                        amountCents: cents == null ? undefined : cents,
                        stripeReason: refundReason,
                        note: refundNote,
                      });
                    })
                  }
                  className="inline-flex w-full items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Issue refund
                </button>
                {!hasStripePayment ? (
                  <div className="text-xs text-gray-500">No Stripe payment intent on this session.</div>
                ) : null}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-gray-500">Provider reassignment</div>
              <div className="mt-2 space-y-2">
                <input
                  value={newProviderId}
                  onChange={(e) => setNewProviderId(e.target.value)}
                  placeholder="New provider user ID"
                  disabled={working !== null}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
                <textarea
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                  placeholder="Reassignment note (required for audit)"
                  disabled={working !== null}
                  className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={working !== null || !newProviderId.trim()}
                  onClick={() =>
                    run('reassign', async () => {
                      await post('/api/admin/sessions/reassign-provider', { sessionId, newProviderId, note: reassignNote });
                      setNewProviderId('');
                      setReassignNote('');
                    })
                  }
                  className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  Reassign provider
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <div className="text-xs font-semibold text-gray-500">Disputes</div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">Open dispute</div>
                <div className="mt-3 space-y-2">
                  <input
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Reason (required)"
                    disabled={working !== null || hasDispute}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  />
                  <textarea
                    value={disputeNote}
                    onChange={(e) => setDisputeNote(e.target.value)}
                    placeholder="Optional note"
                    disabled={working !== null || hasDispute}
                    className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={working !== null || hasDispute || !disputeReason.trim()}
                    onClick={() =>
                      run('open-dispute', async () => {
                        await post('/api/admin/disputes/open', { sessionId, reason: disputeReason, note: disputeNote });
                        setDisputeReason('');
                        setDisputeNote('');
                      })
                    }
                    className="inline-flex w-full items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Open dispute
                  </button>
                  {hasDispute ? (
                    <div className="text-xs text-gray-500">Dispute already open: {String(props.disputeId || '').trim()}</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">Resolve dispute</div>
                <div className="mt-3 space-y-2">
                  <select
                    value={disputeOutcomeStatus}
                    onChange={(e) => setDisputeOutcomeStatus(e.target.value)}
                    disabled={working !== null || !hasDispute}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  >
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                    <option value="provider_no_show">provider_no_show</option>
                    <option value="student_no_show">student_no_show</option>
                    <option value="refunded">refunded</option>
                  </select>
                  <textarea
                    value={disputeResolution}
                    onChange={(e) => setDisputeResolution(e.target.value)}
                    placeholder="Resolution summary (required)"
                    disabled={working !== null || !hasDispute}
                    className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={working !== null || !hasDispute || !disputeResolution.trim()}
                    onClick={() =>
                      run('resolve-dispute', async () => {
                        await post('/api/admin/disputes/resolve', {
                          disputeId: String(props.disputeId || '').trim(),
                          resolution: disputeResolution,
                          outcomeStatus: disputeOutcomeStatus,
                        });
                        setDisputeResolution('');
                      })
                    }
                    className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Resolve dispute
                  </button>
                  {!hasDispute ? <div className="text-xs text-gray-500">No open dispute for this session.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

