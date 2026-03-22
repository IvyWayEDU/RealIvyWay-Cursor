'use client';

import { useEffect, useState } from 'react';

function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

export default function ProviderEarningsSnapshotClient(props: {
  initialTotalEarningsCents: number;
  initialAvailableBalanceCents: number;
  initialPendingPayoutsCents: number;
  initialTotalWithdrawnCents: number;
}) {
  const [summary, setSummary] = useState({
    totalEarningsCents: props.initialTotalEarningsCents || 0,
    availableBalanceCents: props.initialAvailableBalanceCents || 0,
    pendingPayoutsCents: props.initialPendingPayoutsCents || 0,
    totalWithdrawnCents: props.initialTotalWithdrawnCents || 0,
  });

  async function refresh() {
    try {
      const res = await fetch('/api/provider/earnings/summary', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (res.ok && typeof data?.availableBalanceCents === 'number') {
        // Temporary debug logs (remove after verification).
        console.log('[EARNINGS_SNAPSHOT_DEBUG]', {
          earningsRows: Number(data?.earningsRows ?? 0),
          totalEarningsCents: Number(data.totalEarningsCents || 0),
          pendingPayoutsCents: Number(data.pendingPayoutsCents || 0),
          totalWithdrawnCents: Number(data.totalWithdrawnCents || 0),
          availableBalanceCents: Number(data.availableBalanceCents || 0),
        });
        setSummary({
          totalEarningsCents: Number(data.totalEarningsCents || 0),
          availableBalanceCents: Number(data.availableBalanceCents || 0),
          pendingPayoutsCents: Number(data.pendingPayoutsCents || 0),
          totalWithdrawnCents: Number(data.totalWithdrawnCents || 0),
        });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    const interval = setInterval(() => refresh().catch(() => {}), 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15.75a1.125 1.125 0 011.125-1.125h.375M6 10.5a.75.75 0 01.75-.75H7.5a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75v-.75zM13.5 10.5a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Earnings Snapshot</h2>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="text-sm font-medium text-gray-500">Total Earnings</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrencyFromCents(summary.totalEarningsCents)}</div>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="text-sm font-medium text-gray-500">Available</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrencyFromCents(summary.availableBalanceCents)}</div>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="text-sm font-medium text-gray-500">Pending Payouts</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrencyFromCents(summary.pendingPayoutsCents)}</div>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="text-sm font-medium text-gray-500">Withdrawn</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrencyFromCents(summary.totalWithdrawnCents)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


