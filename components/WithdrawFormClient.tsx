'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BankAccount } from '@/lib/payouts/bank-account-storage';

interface WithdrawFormClientProps {
  availableBalanceCents: number;
  bankAccount: BankAccount | null;
}

export default function WithdrawFormClient({ 
  availableBalanceCents: initialAvailableBalanceCents,
  bankAccount: initialBankAccount,
}: WithdrawFormClientProps) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(initialBankAccount);
  // Track available balance locally for optimistic updates
  const [availableBalanceCents, setAvailableBalanceCents] = useState(initialAvailableBalanceCents);
  
  // Update local state when prop changes (after refresh)
  useEffect(() => {
    setBankAccount(initialBankAccount);
    setAvailableBalanceCents(initialAvailableBalanceCents);
  }, [initialBankAccount, initialAvailableBalanceCents]);
  
  // Bank account form state
  const [bankFormData, setBankFormData] = useState({
    bankName: '',
    accountHolderName: '',
    routingNumber: '',
    accountNumber: '',
    accountType: 'checking' as 'checking' | 'savings',
  });
  const [bankFormError, setBankFormError] = useState<string | null>(null);
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);

  // Initialize form data when opening modal for update
  useEffect(() => {
    if (showBankModal && bankAccount) {
      setBankFormData({
        bankName: bankAccount.bankName,
        accountHolderName: '', // Not stored, so don't pre-fill
        routingNumber: '', // Not stored, so don't pre-fill
        accountNumber: '', // Don't pre-fill account number for security
        accountType: bankAccount.accountType,
      });
    } else if (showBankModal && !bankAccount) {
      // Reset form for new bank account
      setBankFormData({
        bankName: '',
        accountHolderName: '',
        routingNumber: '',
        accountNumber: '',
        accountType: 'checking',
      });
    }
    setBankFormError(null);
  }, [showBankModal, bankAccount]);

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setAmountError(null);
      setError(null);
      // Live validation
      if (value.trim() !== '') {
        const validationError = validateAmount(value);
        setAmountError(validationError);
      }
    }
  };

  const validateAmount = (amountValue: string): string | null => {
    if (!amountValue || amountValue.trim() === '') {
      return null; // Don't show error for empty input (user might be typing)
    }

    const amountNum = parseFloat(amountValue);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'Amount must be greater than 0';
    }

    const amountCents = Math.round(amountNum * 100);
    if (amountCents > availableBalanceCents) {
      return `Amount cannot exceed available balance of ${formatCurrency(availableBalanceCents)}`;
    }

    return null;
  };

  const handleBankAccountSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBankFormError(null);

    // Validate form
    if (!bankFormData.bankName.trim()) {
      setBankFormError('Bank name is required');
      return;
    }
    if (!bankFormData.accountHolderName.trim()) {
      setBankFormError('Account holder name is required');
      return;
    }
    if (!/^\d{9}$/.test(bankFormData.routingNumber.trim())) {
      setBankFormError('Routing number must be exactly 9 digits');
      return;
    }
    if (!/^\d{4,17}$/.test(bankFormData.accountNumber.trim())) {
      setBankFormError('Account number must be between 4 and 17 digits');
      return;
    }

    setIsSavingBankAccount(true);

    try {
      const response = await fetch('/api/payouts/bank-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bankFormData),
      });

      const data = await response.json();

      if (data.success && data.bankAccount) {
        // Update local state immediately with the returned bank account (already masked)
        setBankAccount(data.bankAccount as BankAccount);
        setShowBankModal(false);
        // Optionally refresh to ensure server state is in sync
        router.refresh();
      } else {
        setBankFormError(data?.message || data?.error || 'Unable to save bank account. Please try again.');
        setIsSavingBankAccount(false);
      }
    } catch (err) {
      console.error('Error saving bank account:', err);
      setBankFormError('Unable to save bank account. Please try again.');
      setIsSavingBankAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate amount
    const validationError = validateAmount(amount);
    if (validationError) {
      setAmountError(validationError);
      setError(validationError);
      return;
    }

    // Check bank account
    if (!bankAccount) {
      setError('Please connect a bank account before requesting a withdrawal');
      return;
    }

    setIsSubmitting(true);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const route = '/api/payouts/withdrawal-request';
      const payload = { amountCents };

      // TEMP DEBUG LOGS (remove after validation)
      console.log('[WithdrawFormClient] Submitting withdrawal request:', { route, payload });

      const response = await fetch(route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = { success: false, error: raw || 'Non-JSON response' };
      }

      // TEMP DEBUG LOGS (remove after validation)
      console.log('[WithdrawFormClient] Withdrawal response:', {
        status: response.status,
        body: data,
      });
      console.log('withdrawal response', data);

      if (data.success) {
        // Optimistically update available balance immediately (subtract the withdrawn amount)
        setAvailableBalanceCents(prev => Math.max(0, prev - amountCents));
        setSuccess(true);
        setIsSubmitting(false);
        // Ensure we don't show stale balances on the next screen.
        router.refresh();
        // Redirect to earnings page after a brief delay
        setTimeout(() => {
          router.push('/dashboard/earnings');
        }, 2000);
      } else {
        setError(data?.message || data?.error || 'Withdrawal request failed.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Error submitting withdrawal request:', err);
      setError('Withdrawal request failed.');
      setIsSubmitting(false);
    }
  };

  // Check if amount is valid for button enabling
  const isAmountValid = amount.trim() !== '' && validateAmount(amount) === null;
  const canSubmit = bankAccount !== null && isAmountValid && !isSubmitting;

  return (
    <div className="space-y-6">
      {/* Available Balance */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Available Balance</h2>
        </div>
        <div className="p-6">
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(availableBalanceCents)}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Total earnings available for withdrawal
          </p>
          
          {/* Success Message */}
          {success && (
            <div className="mt-6 rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Withdrawal request submitted successfully
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Payout requested. Our team will process your withdrawal.</p>
                    <p className="mt-1">Redirecting to earnings page...</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal Form */}
          {!success && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Withdrawal Amount Input */}
              <div>
                <label htmlFor="withdrawal-amount" className="block text-sm font-medium text-gray-700">
                  Withdrawal Amount
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="text"
                    id="withdrawal-amount"
                    value={amount}
                    onChange={handleAmountChange}
                    className={`block w-full rounded-md border-gray-300 pl-7 pr-12 py-2 text-gray-900 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm ${
                      amountError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                    }`}
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
                {amountError && (
                  <p className="mt-2 text-sm text-red-600">{amountError}</p>
                )}
                {!amountError && amount.trim() !== '' && (
                  <p className="mt-2 text-sm text-gray-500">
                    Maximum withdrawal: {formatCurrency(availableBalanceCents)}
                  </p>
                )}
                {!bankAccount && (
                  <p className="mt-2 text-sm text-gray-500">
                    Please connect a bank account to submit a withdrawal request
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                <Link
                  href="/dashboard/earnings"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center rounded-md bg-[#0088CB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Withdrawal Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Bank Account Section */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Bank Account</h2>
        </div>
        <div className="p-6">
          {bankAccount ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Bank Name</p>
                  <p className="mt-1 text-sm text-gray-900">{bankAccount.bankName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Account Number</p>
                  <p className="mt-1 text-sm text-gray-900">****{bankAccount.last4}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Account Type</p>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{bankAccount.accountType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Connected</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(bankAccount.connectedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowBankModal(true)}
                  className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
                >
                  Update Bank Account
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
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
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No bank account connected</h3>
              <p className="mt-1 text-sm text-gray-500">
                You need to connect a bank account before you can request withdrawals.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowBankModal(true)}
                  className="inline-flex items-center rounded-md bg-[#0088CB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
                >
                  Connect Bank Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bank Account Connection Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => !isSavingBankAccount && setShowBankModal(false)}
            />
            
            {/* Modal */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg
                    className="h-6 w-6 text-[#0088CB]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    {bankAccount ? 'Update Bank Account' : 'Connect Bank Account'}
                  </h3>
                  <div className="mt-4">
                    <form onSubmit={handleBankAccountSubmit} className="space-y-4">
                      {/* Bank Name */}
                      <div>
                        <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="bankName"
                          required
                          value={bankFormData.bankName}
                          onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                          placeholder="Enter bank name"
                          disabled={isSavingBankAccount}
                        />
                      </div>

                      {/* Account Holder Name */}
                      <div>
                        <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700">
                          Account Holder Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="accountHolderName"
                          required
                          value={bankFormData.accountHolderName}
                          onChange={(e) => setBankFormData({ ...bankFormData, accountHolderName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                          placeholder="Enter account holder name"
                          disabled={isSavingBankAccount}
                        />
                      </div>

                      {/* Routing Number */}
                      <div>
                        <label htmlFor="routingNumber" className="block text-sm font-medium text-gray-700">
                          Routing Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="routingNumber"
                          required
                          pattern="[0-9]{9}"
                          maxLength={9}
                          value={bankFormData.routingNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                            setBankFormData({ ...bankFormData, routingNumber: value });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                          placeholder="000000000"
                          disabled={isSavingBankAccount}
                        />
                        <p className="mt-1 text-xs text-gray-500">9 digits</p>
                      </div>

                      {/* Account Number */}
                      <div>
                        <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">
                          Account Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="accountNumber"
                          required
                          value={bankFormData.accountNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 17);
                            setBankFormData({ ...bankFormData, accountNumber: value });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                          placeholder={bankAccount ? 'Enter new account number' : 'Enter account number'}
                          disabled={isSavingBankAccount}
                        />
                        <p className="mt-1 text-xs text-gray-500">4-17 digits</p>
                      </div>

                      {/* Account Type */}
                      <div>
                        <label htmlFor="accountType" className="block text-sm font-medium text-gray-700">
                          Account Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="accountType"
                          required
                          value={bankFormData.accountType}
                          onChange={(e) => setBankFormData({ ...bankFormData, accountType: e.target.value as 'checking' | 'savings' })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-3 py-2 border"
                          disabled={isSavingBankAccount}
                        >
                          <option value="checking">Checking</option>
                          <option value="savings">Savings</option>
                        </select>
                      </div>

                      {bankFormError && (
                        <div className="rounded-md bg-red-50 p-3">
                          <p className="text-sm text-red-800">{bankFormError}</p>
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button
                          type="submit"
                          disabled={isSavingBankAccount}
                          className="inline-flex w-full justify-center rounded-md bg-[#0088CB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                        >
                          {isSavingBankAccount ? 'Saving...' : bankAccount ? 'Update Account' : 'Connect Account'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBankModal(false)}
                          disabled={isSavingBankAccount}
                          className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

