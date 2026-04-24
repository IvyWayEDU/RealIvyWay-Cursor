'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const hasLinkParams = useMemo(() => Boolean(uid && token), [uid, token]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasLinkParams) {
      setError('Invalid or expired reset link.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, newPassword, confirmPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || 'Failed to reset password');
      }
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100svh] flex items-start sm:items-center justify-center bg-gray-100 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#0088CB] px-5 sm:px-8 py-7 sm:py-8 flex flex-col items-center">
            <div className="mb-6 flex items-center justify-center">
              <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Image
                  src="/logo/ivyway-logo.png"
                  alt="IvyWay Logo"
                  width={80}
                  height={27}
                  className="object-contain"
                />
              </div>
            </div>

            <h1 className="text-white text-2xl font-semibold mb-2 text-center">Choose a new password</h1>
            <p className="text-white text-sm text-center opacity-90">
              This reset link is single-use and expires automatically.
            </p>
          </div>

          <div className="px-5 sm:px-8 py-7 sm:py-8">
            {success ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-4 border border-green-200">
                  <p className="text-sm text-green-800">Your password has been updated. You can log in now.</p>
                </div>
                <Link
                  href="/auth/login"
                  className="inline-flex w-full items-center justify-center rounded-md bg-[#0088CB] text-white py-3 px-4 font-medium hover:bg-[#0070A3] transition-colors"
                >
                  Go to login
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                {!hasLinkParams ? (
                  <div className="rounded-md bg-red-50 p-4 border border-red-200">
                    <p className="text-sm text-red-800">Invalid or expired reset link.</p>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-md bg-red-50 p-4 border border-red-200">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="newPassword">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                    disabled={!hasLinkParams || submitting}
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 6 characters.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="confirmPassword">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                    disabled={!hasLinkParams || submitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!hasLinkParams || submitting}
                  className="w-full bg-[#0088CB] text-white py-3 px-4 rounded-md font-medium hover:bg-[#0070A3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating…' : 'Update password'}
                </button>

                <div className="text-center text-sm text-gray-600">
                  <Link href="/auth/login" className="font-medium text-[#0088CB] hover:underline">
                    Back to login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

