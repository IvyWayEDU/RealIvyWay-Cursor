'use client';

import { useEffect, useMemo, useState } from 'react';

type StripeConnectStatus = 'loading' | 'not_created' | 'incomplete' | 'restricted' | 'connected' | 'error';

function formatCurrencyFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export default function WithdrawEarningsClient({
  availableBalanceCents,
  pendingPayoutsCents,
  totalWithdrawnCents,
  stripeConnected,
}: {
  availableBalanceCents: number;
  pendingPayoutsCents: number;
  totalWithdrawnCents: number;
  stripeConnected: boolean;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [amountInput, setAmountInput] = useState<string>('');
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus>(stripeConnected ? 'loading' : 'not_created');
  const [summary, setSummary] = useState<{
    availableBalanceCents: number;
    pendingPayoutsCents: number;
    totalWithdrawnCents: number;
  }>({
    availableBalanceCents: availableBalanceCents || 0,
    pendingPayoutsCents: pendingPayoutsCents || 0,
    totalWithdrawnCents: totalWithdrawnCents || 0,
  });

  async function refreshSummary() {
    try {
      const res = await fetch('/api/provider/earnings/summary', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (res.ok && typeof data?.availableBalanceCents === 'number') {
        setSummary({
          availableBalanceCents: Number(data.availableBalanceCents || 0),
          pendingPayoutsCents: Number(data.pendingPayoutsCents || 0),
          totalWithdrawnCents: Number(data.totalWithdrawnCents || 0),
        });
      }
    } catch {
      // ignore
    }
  }

  async function refreshStripeStatus() {
    try {
      const res = await fetch('/api/stripe/connect/status', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as any;
      const status = String(data?.status || '').trim();
      if (!res.ok) throw new Error(data?.error || `Failed to fetch Stripe status (${res.status})`);
      if (status === 'not_created' || status === 'incomplete' || status === 'restricted' || status === 'connected') {
        setStripeStatus(status);
      } else {
        setStripeStatus('error');
      }
    } catch {
      setStripeStatus('error');
    }
  }

  // Keep summary fresh while the page is open (session completes / admin approves / etc).
  useEffect(() => {
    refreshSummary().catch(() => {});
    refreshStripeStatus().catch(() => {});
    const interval = setInterval(() => {
      refreshSummary().catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableBalanceLabel = useMemo(
    () => formatCurrencyFromCents(summary.availableBalanceCents),
    [summary.availableBalanceCents]
  );
  const pendingLabel = useMemo(
    () => formatCurrencyFromCents(summary.pendingPayoutsCents),
    [summary.pendingPayoutsCents]
  );
  const withdrawnLabel = useMemo(
    () => formatCurrencyFromCents(summary.totalWithdrawnCents),
    [summary.totalWithdrawnCents]
  );

  const amountCents = useMemo(() => {
    const raw = amountInput.trim();
    if (!raw) return 0;
    const dollars = Number(raw);
    if (!Number.isFinite(dollars)) return NaN;
    return Math.round(dollars * 100);
  }, [amountInput]);

  const amountError = useMemo(() => {
    if (!amountInput.trim()) return 'Enter an amount';
    if (!Number.isFinite(amountCents)) return 'Enter a valid number';
    if (!Number.isInteger(amountCents)) return 'Enter a valid amount';
    if (amountCents <= 0) return 'Amount must be greater than 0';
    if (amountCents > summary.availableBalanceCents) return 'Amount cannot exceed available balance';
    return null;
  }, [amountInput, amountCents, summary.availableBalanceCents]);

  async function handleConnectStripe() {
    setIsConnectingStripe(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect/create-account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || `Failed to create Stripe onboarding link (${res.status})`);
      }
      window.location.href = data.url;
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsConnectingStripe(false);
    }
  }

  async function handleRequestWithdrawal() {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/stripe/payout/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data?.success) {
        throw new Error('Withdrawal request failed');
      }

      setSuccess(true);
      setAmountInput('');
      await refreshSummary();
    } catch (e) {
      setError('Withdrawal request failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isStripeConnected = stripeStatus === 'connected';
  const canSubmit = !isSubmitting && !amountError && isStripeConnected;

  function renderPayoutMethod() {
    if (stripeStatus === 'loading') {
      return <div className="text-sm text-gray-700">Checking Stripe connection status…</div>;
    }
    if (stripeStatus === 'connected') {
      return <div className="text-sm font-medium text-green-700">Stripe Account Connected</div>;
    }
    if (stripeStatus === 'restricted') {
      return (
        <div className="space-y-3">
          <div className="text-sm text-orange-800">
            Your Stripe account is connected but payouts are not enabled yet. Complete any required steps in Stripe.
          </div>
          <button
            type="button"
            onClick={handleConnectStripe}
            disabled={isConnectingStripe}
            className="inline-flex items-center justify-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnectingStripe ? 'Opening…' : 'Set Up Stripe Account'}
          </button>
        </div>
      );
    }
    if (stripeStatus === 'incomplete') {
      return (
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            Set up your Stripe account to receive payouts.
          </div>
          <button
            type="button"
            onClick={handleConnectStripe}
            disabled={isConnectingStripe}
            className="inline-flex items-center justify-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnectingStripe ? 'Opening…' : 'Set Up Stripe Account'}
          </button>
        </div>
      );
    }
    if (stripeStatus === 'not_created') {
      return (
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            To receive payouts, set up and connect your Stripe account.
          </div>
          <button
            type="button"
            onClick={handleConnectStripe}
            disabled={isConnectingStripe}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnectingStripe ? 'Creating…' : 'Create Stripe Account'}
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-700">Unable to determine Stripe connection status.</div>
        <button
          type="button"
          onClick={() => refreshStripeStatus()}
          disabled={isConnectingStripe}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Available Balance */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Available Balance</h2>
        </div>
        <div className="p-6">
          <div className="text-3xl font-bold text-gray-900">{availableBalanceLabel}</div>
          <p className="mt-2 text-sm text-gray-600">
            This is your withdrawable balance from completed earnings that have not yet been paid out.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-md border border-gray-200 p-3">
            <dt className="text-gray-500">Pending Payouts</dt>
              <dd className="mt-1 font-semibold text-gray-900">{pendingLabel}</dd>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <dt className="text-gray-500">Total Withdrawn</dt>
              <dd className="mt-1 font-semibold text-gray-900">{withdrawnLabel}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Payout Method */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Payout Method</h2>
        </div>
        <div className="p-6">
          {renderPayoutMethod()}
        </div>
      </div>

      {/* Request Withdrawal */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Withdraw</h2>
        </div>
        <div className="p-6">
          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">
                Withdrawal request submitted successfully. Status: Pending Approval.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="withdraw-amount" className="block text-sm font-medium text-gray-900">
              Enter amount to withdraw
            </label>
            <div className="mt-2">
              <input
                id="withdraw-amount"
                inputMode="decimal"
                type="number"
                min={0}
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB]"
              />
            </div>
            {amountError ? <p className="mt-2 text-sm text-gray-500">{amountError}</p> : null}
            {!isStripeConnected ? (
              <p className="mt-2 text-sm text-gray-500">Connect and finish Stripe setup before requesting a withdrawal.</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleRequestWithdrawal}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center rounded-md bg-[#0088CB] px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Requesting...' : 'Request Withdrawal'}
          </button>

          {summary.availableBalanceCents <= 0 && (
            <p className="mt-2 text-sm text-gray-500">You have no available balance to withdraw yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}



