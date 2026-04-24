'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to send reset email');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
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

            <h1 className="text-white text-2xl font-semibold mb-2 text-center">Reset your password</h1>
            <p className="text-white text-sm text-center opacity-90">
              Enter your email and we’ll send a secure reset link.
            </p>
          </div>

          <div className="px-5 sm:px-8 py-7 sm:py-8">
            {error ? (
              <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            ) : null}

            {sent ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-4 border border-green-200">
                  <p className="text-sm text-green-800">
                    If an account exists for that email, a password reset link has been sent.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Check your inbox and spam folder. The link expires after a short time and can be used only once.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-flex w-full items-center justify-center rounded-md bg-[#0088CB] text-white py-3 px-4 font-medium hover:bg-[#0070A3] transition-colors"
                >
                  Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#0088CB] text-white py-3 px-4 rounded-md font-medium hover:bg-[#0070A3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>

                <div className="text-center text-sm text-gray-600">
                  Remembered your password?{' '}
                  <Link href="/auth/login" className="font-medium text-[#0088CB] hover:underline">
                    Log in
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

