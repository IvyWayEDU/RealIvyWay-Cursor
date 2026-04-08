'use client';

import { useState } from 'react';
import { ReferralCredit } from '@/lib/models/types';

interface ReferralsSectionProps {
  credits: ReferralCredit[];
  isLoading?: boolean;
  userId?: string | null;
}

/**
 * Generate a user's referral code from their user ID
 * Uses a simple encoding: takes first 8 characters of userId and converts to uppercase
 */
function generateReferralCode(userId: string): string {
  // Remove hyphens and take first 8 characters, convert to uppercase
  const cleanId = userId.replace(/-/g, '').substring(0, 8).toUpperCase();
  return cleanId;
}

export default function ReferralsSection({ credits, isLoading = false, userId }: ReferralsSectionProps) {
  const [copied, setCopied] = useState(false);

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const pendingCredits = credits.filter((c) => c.status === 'pending');
  const completedCredits = credits.filter((c) => c.status === 'completed');
  const totalCompletedAmount = completedCredits.reduce((sum, c) => sum + c.amountCents, 0);

  const handleCopyCode = async () => {
    if (!userId) return;
    const code = generateReferralCode(userId);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-600">Loading referral credits...</div>
      </div>
    );
  }

  const userReferralCode = userId ? generateReferralCode(userId) : null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      {/* User Referral Code Section */}
      {userReferralCode && (
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Referral Code</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3">
              <code className="text-lg font-mono font-semibold text-gray-900">{userReferralCode}</code>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-4 py-3 bg-[#0088CB] text-white font-medium rounded-lg hover:bg-[#0077B3] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Share this code with friends. You earn $10 when they complete their first paid session.
          </p>
        </div>
      )}

      {/* Referral Credits Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Referral Credits</h3>
        
        {/* Available Credit Balance */}
        {totalCompletedAmount > 0 && (
          <div className="mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-900">Available Referral Credit</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {formatCurrency(totalCompletedAmount)}
                  </p>
                </div>
                <svg
                  className="w-8 h-8 text-green-600"
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
              </div>
            </div>
          </div>
        )}
        
        <p className="text-sm text-gray-600">
          Pending credits become available after the referred user completes their first paid session.
        </p>
      </div>

      {/* Completed Credits List */}
      {completedCredits.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Completed Credits</h4>
          <div className="space-y-3">
            {completedCredits.map((credit) => {
              return (
                <div
                  key={credit.id}
                  className="border rounded-lg p-4 border-gray-200 bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(credit.amountCents)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Completed:</span>
                          <span className="font-medium text-green-700">{formatDate(credit.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Credits */}
      {pendingCredits.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Pending Credits</h4>
          <div className="space-y-2">
            {pendingCredits.map((credit) => (
              <div
                key={credit.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(credit.amountCents)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">Created {formatDate(credit.createdAt)}</span>
                  </div>
                  <span className="text-xs text-amber-700">Pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Credits Message */}
      {credits.length === 0 && (
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-600">No referral credits yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Referral credits will appear here when you receive them
          </p>
        </div>
      )}
    </div>
  );
}

