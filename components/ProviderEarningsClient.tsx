'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@/lib/models/types';
import { getCurrentUserId } from '@/lib/sessions/actions';
import { getEarningsServiceLabel } from '@/lib/earnings/serviceLabel';
import { getCanonicalServiceType } from '@/lib/sessions/sessionDisplay';

interface Booking {
  id: string;
  providerPayoutCents: number;
  payoutStatus: 'available' | 'pending_payout' | 'approved' | 'paid' | 'paid_out';
  serviceLabel: string;
  completedAt?: string;
  bookedAt: string;
  scheduledStartTime: string;
}

export default function ProviderEarningsClient(props: {
  totalEarningsCents: number;
  availableBalanceCents: number;
  pendingPayoutsCents: number;
  totalWithdrawnCents: number;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    totalEarningsCents: number;
    availableBalanceCents: number;
    pendingPayoutsCents: number;
    totalWithdrawnCents: number;
  }>({
    totalEarningsCents: props.totalEarningsCents || 0,
    availableBalanceCents: props.availableBalanceCents || 0,
    pendingPayoutsCents: props.pendingPayoutsCents || 0,
    totalWithdrawnCents: props.totalWithdrawnCents || 0,
  });
  const lastJsonRef = useRef<string>('');
  const didInitialLoadRef = useRef<boolean>(false);
  const providerIdRef = useRef<string>('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { userId } = await getCurrentUserId();
        if (!userId) {
          if (!didInitialLoadRef.current) {
            setSessions([]);
            setLoading(false);
          }
          return;
        }
        providerIdRef.current = userId;

        // Fetch earnings summary (source of truth for totals/balances)
        try {
          const sres = await fetch('/api/provider/earnings/summary', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          });
          const sdata = (await sres.json().catch(() => ({}))) as any;
          if (sres.ok && typeof sdata?.availableBalanceCents === 'number') {
            // Temporary debug logs (remove after verification).
            console.log('[EARNINGS_CLIENT_DEBUG]', {
              earningsRows: Number(sdata?.earningsRows ?? 0),
              totalEarningsCents: Number(sdata.totalEarningsCents || 0),
              pendingPayoutsCents: Number(sdata.pendingPayoutsCents || 0),
              totalWithdrawnCents: Number(sdata.totalWithdrawnCents || 0),
              availableBalanceCents: Number(sdata.availableBalanceCents || 0),
            });
            setSummary({
              totalEarningsCents: Number(sdata.totalEarningsCents || 0),
              availableBalanceCents: Number(sdata.availableBalanceCents || 0),
              pendingPayoutsCents: Number(sdata.pendingPayoutsCents || 0),
              totalWithdrawnCents: Number(sdata.totalWithdrawnCents || 0),
            });
          }
        } catch {
          // ignore summary failures; sessions table still loads
        }

        // Read real sessions from the server (auth-scoped)
        const res = await fetch('/api/sessions/all', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch sessions (${res.status})`);
        }
        const data = (await res.json()) as { sessions?: Session[]; completedSessions?: Session[] };
        const allSessions = Array.isArray((data as any)?.sessions)
          ? ((data as any).sessions as Session[])
          : Array.isArray((data as any)?.completedSessions)
            ? ((data as any).completedSessions as Session[])
            : [];

        // Source of truth: completed sessions for this provider.
        const completedSessions = allSessions.filter(
          (s) =>
            s.providerId === userId &&
            s.status === 'completed' &&
            ((s as any).providerEligibleForPayout === true || (s as any).provider_eligible_for_payout === true)
        );
        const nextStr = JSON.stringify(completedSessions);
        if (nextStr !== lastJsonRef.current) {
          lastJsonRef.current = nextStr;
          setSessions(completedSessions);
        }
      } catch (error) {
        console.error('Error fetching earnings:', error);
        if (!didInitialLoadRef.current) setSessions([]);
      } finally {
        if (!didInitialLoadRef.current) {
          didInitialLoadRef.current = true;
          setLoading(false);
        }
      }
    };

    fetchSessions().catch(() => {});
    
    // Poll (no faster than every 20 seconds) and only update state if data changed
    const interval = setInterval(fetchSessions, 20000);
    return () => clearInterval(interval);
  }, []);

  // Convert sessions to bookings format for the graph
  const bookings: Booking[] = sessions.map((session) => {
    const earningsCents =
      (session as any).providerPayoutCents || (session as any).provider_payout_cents || 0;
    const earnings = earningsCents / 100;

    console.log('Earnings display:', {
      providerPayoutCents: (session as any).providerPayoutCents,
      computed: earnings,
    });

    const payoutStatus =
      (session.payoutStatus as any) ||
      ('available' as 'available' | 'pending_payout' | 'approved' | 'paid' | 'paid_out');
    const canonicalServiceType = getCanonicalServiceType(session);
    const serviceLabel = getEarningsServiceLabel(canonicalServiceType ?? (session as any)?.serviceType ?? (session as any)?.service_type ?? '');

    return {
      id: session.id,
      providerPayoutCents: earningsCents,
      payoutStatus,
      serviceLabel,
      completedAt: session.actualEndTime || session.scheduledEndTime,
      bookedAt: session.bookedAt,
      scheduledStartTime: session.scheduledStartTime,
    };
  });

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
      case 'paid_out':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Paid
          </span>
        );
      case 'pending_payout':
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Available
          </span>
        );
    }
  };

  // Fallback totals from sessions (graph/table). Source-of-truth balances come from summary endpoint.
  const totalEarningsFromSessionsCents = bookings.reduce((sum, booking) => sum + booking.providerPayoutCents, 0);
  const totalEarningsCents = summary.totalEarningsCents || totalEarningsFromSessionsCents;
  const availableBalanceCents = summary.availableBalanceCents || 0;
  const totalWithdrawnCents = summary.totalWithdrawnCents || 0;
  const pendingPayoutsCents = summary.pendingPayoutsCents || 0;

  // Temporary debug logs (remove after verification).
  if (typeof window !== 'undefined') {
    // Only log when we have at least attempted loading.
    if (!loading) {
      console.log('[EARNINGS_BREAKDOWN_DEBUG]', {
        earningsRowsShown: bookings.length,
        totalEarningsFromBreakdownCents: totalEarningsFromSessionsCents,
        totalEarningsCents,
        pendingPayoutsCents,
        totalWithdrawnCents,
        availableBalanceCents,
      });
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0088CB]"></div>
        <p className="mt-4 text-sm text-gray-500">Loading earnings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Withdraw Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Earnings Overview</h2>
          <p className="mt-1 text-sm text-gray-600">
            Total earnings: {formatCurrency(totalEarningsCents)}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/earnings/withdraw')}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] transition-colors"
        >
          Withdraw
        </button>
      </div>

      {/* Payout Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Available Balance</dt>
                <dd className="text-lg font-semibold text-gray-900">{formatCurrency(availableBalanceCents)}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Withdrawn</dt>
                <dd className="text-lg font-semibold text-gray-900">{formatCurrency(totalWithdrawnCents)}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Pending Payouts</dt>
                <dd className="text-lg font-semibold text-gray-900">{formatCurrency(pendingPayoutsCents)}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Breakdown Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Earnings Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Earned
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No earnings yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Your earnings will appear here after completing sessions.
                    </p>
                  </td>
                </tr>
              ) : (
                bookings
                  .sort((a, b) => {
                    const dateA = new Date(a.completedAt || a.bookedAt || a.scheduledStartTime);
                    const dateB = new Date(b.completedAt || b.bookedAt || b.scheduledStartTime);
                    return dateB.getTime() - dateA.getTime(); // Most recent first
                  })
                  .map((booking) => {
                    const earnings = booking.providerPayoutCents / 100;
                    return (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(booking.completedAt || booking.bookedAt || booking.scheduledStartTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {booking.serviceLabel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {`$${earnings.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getStatusBadge(booking.payoutStatus)}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

