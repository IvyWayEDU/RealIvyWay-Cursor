'use client';

import { useEffect, useMemo, useState } from 'react';

type PayoutMethod = 'wise' | 'paypal' | 'zelle' | 'bank';

type PayoutDetailsResponse = {
  payoutMethod?: string;
  wiseEmail?: string;
  paypalEmail?: string;
  zelleContact?: string;
  bankName?: string;
  bankCountry?: string;
  hasBankAccountNumber?: boolean;
  bankAccountNumberLast4?: string | null;
  hasBankRoutingNumber?: boolean;
  bankRoutingNumberLast4?: string | null;
};

export default function ProviderPayoutDetailsFormClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [saved, setSaved] = useState<PayoutDetailsResponse | null>(null);

  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('wise');
  const [wiseEmail, setWiseEmail] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [zelleContact, setZelleContact] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCountry, setBankCountry] = useState('US');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const res = await fetch('/api/provider/payout-details', { method: 'GET' });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load payout details');
        }
        const details = (json?.payoutDetails || {}) as PayoutDetailsResponse;
        if (cancelled) return;

        setSaved(details);

        const methodRaw = String(details.payoutMethod || '').trim().toLowerCase();
        if (methodRaw === 'wise' || methodRaw === 'paypal' || methodRaw === 'zelle' || methodRaw === 'bank') {
          setPayoutMethod(methodRaw);
        }
        setWiseEmail(details.wiseEmail || '');
        setPaypalEmail(details.paypalEmail || '');
        setZelleContact(details.zelleContact || '');
        setBankName(details.bankName || '');
        setBankCountry((details.bankCountry || 'US').toUpperCase());
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load payout details');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const bankAccountSavedLabel = useMemo(() => {
    if (!saved?.hasBankAccountNumber || !saved.bankAccountNumberLast4) return null;
    return `Saved ending in ****${saved.bankAccountNumberLast4}`;
  }, [saved]);

  const bankRoutingSavedLabel = useMemo(() => {
    if (!saved?.hasBankRoutingNumber || !saved.bankRoutingNumberLast4) return null;
    return `Saved ending in ****${saved.bankRoutingNumberLast4}`;
  }, [saved]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      const payload: Record<string, any> = { payoutMethod };

      if (payoutMethod === 'wise') {
        payload.wiseEmail = wiseEmail.trim();
      } else if (payoutMethod === 'paypal') {
        payload.paypalEmail = paypalEmail.trim();
      } else if (payoutMethod === 'zelle') {
        payload.zelleContact = zelleContact.trim();
      } else if (payoutMethod === 'bank') {
        payload.bankName = bankName.trim();
        payload.bankCountry = bankCountry.trim().toUpperCase();
        if (bankAccountNumber.trim()) payload.bankAccountNumber = bankAccountNumber.replace(/\s+/g, '');
        if (bankRoutingNumber.trim()) payload.bankRoutingNumber = bankRoutingNumber.replace(/\s+/g, '');
      }

      const res = await fetch('/api/provider/payout-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to save payout details');
      }

      setSaved((json?.payoutDetails || {}) as PayoutDetailsResponse);
      setSuccess(true);
      setBankAccountNumber('');
      setBankRoutingNumber('');
    } catch (e: any) {
      setError(e?.message || 'Failed to save payout details');
      setSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Payout Details</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tell us where to send your payouts.
        </p>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-sm text-gray-600">Loading payout details…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-800">Saved payout details.</p>
              </div>
            )}

            <div>
              <label htmlFor="payoutMethod" className="block text-sm font-medium text-gray-700">
                Payout Method
              </label>
              <select
                id="payoutMethod"
                value={payoutMethod}
                onChange={(e) => {
                  setPayoutMethod(e.target.value as PayoutMethod);
                  setError(null);
                  setSuccess(false);
                }}
                disabled={isSaving}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
              >
                <option value="wise">Wise</option>
                <option value="paypal">PayPal</option>
                <option value="zelle">Zelle</option>
                <option value="bank">Bank transfer</option>
              </select>
            </div>

            {payoutMethod === 'wise' && (
              <div>
                <label htmlFor="wiseEmail" className="block text-sm font-medium text-gray-700">
                  Wise email
                </label>
                <input
                  id="wiseEmail"
                  type="email"
                  value={wiseEmail}
                  onChange={(e) => setWiseEmail(e.target.value)}
                  disabled={isSaving}
                  placeholder="name@example.com"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                />
              </div>
            )}

            {payoutMethod === 'paypal' && (
              <div>
                <label htmlFor="paypalEmail" className="block text-sm font-medium text-gray-700">
                  PayPal email
                </label>
                <input
                  id="paypalEmail"
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  disabled={isSaving}
                  placeholder="name@example.com"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                />
              </div>
            )}

            {payoutMethod === 'zelle' && (
              <div>
                <label htmlFor="zelleContact" className="block text-sm font-medium text-gray-700">
                  Zelle contact (email or phone)
                </label>
                <input
                  id="zelleContact"
                  type="text"
                  value={zelleContact}
                  onChange={(e) => setZelleContact(e.target.value)}
                  disabled={isSaving}
                  placeholder="name@example.com or +1 555…"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                />
              </div>
            )}

            {payoutMethod === 'bank' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">
                      Bank name
                    </label>
                    <input
                      id="bankName"
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      disabled={isSaving}
                      placeholder="Bank of Example"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                    />
                  </div>

                  <div>
                    <label htmlFor="bankCountry" className="block text-sm font-medium text-gray-700">
                      Bank country (2-letter code)
                    </label>
                    <input
                      id="bankCountry"
                      type="text"
                      value={bankCountry}
                      onChange={(e) => setBankCountry(e.target.value.toUpperCase().slice(0, 2))}
                      disabled={isSaving}
                      placeholder="US"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700">
                      Account number
                    </label>
                    <input
                      id="bankAccountNumber"
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      disabled={isSaving}
                      placeholder={bankAccountSavedLabel ? `Leave blank to keep (${bankAccountSavedLabel})` : 'Enter account number'}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                    />
                  </div>

                  <div>
                    <label htmlFor="bankRoutingNumber" className="block text-sm font-medium text-gray-700">
                      Routing number
                    </label>
                    <input
                      id="bankRoutingNumber"
                      type="text"
                      value={bankRoutingNumber}
                      onChange={(e) => setBankRoutingNumber(e.target.value)}
                      disabled={isSaving}
                      placeholder={bankRoutingSavedLabel ? `Leave blank to keep (${bankRoutingSavedLabel})` : 'Enter routing number'}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  For security, saved bank numbers are not displayed. Leave blank to keep existing values.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center rounded-md bg-[#0088CB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving…' : 'Save payout details'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

