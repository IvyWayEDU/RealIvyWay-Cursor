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

  const getDaysUntilExpiration = (expiresAt: string): number => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (credit: ReferralCredit): string => {
    if (credit.status === 'expired' || credit.status === 'used') {
      return 'text-gray-500';
    }
    const daysLeft = getDaysUntilExpiration(credit.expiresAt);
    if (daysLeft <= 7) {
      return 'text-red-600';
    } else if (daysLeft <= 14) {
      return 'text-amber-600';
    }
    return 'text-green-600';
  };

  const activeCredits = credits.filter(
    (c) => c.status === 'active' || c.status === 'partially_used'
  );
  const expiredCredits = credits.filter((c) => c.status === 'expired');
  const usedCredits = credits.filter((c) => c.status === 'used');

  const totalActiveAmount = activeCredits.reduce(
    (sum, c) => sum + c.remainingAmountCents,
    0
  );

  // Calculate earliest expiration date for active credits
  const earliestExpiration = activeCredits.length > 0
    ? activeCredits.reduce((earliest, credit) => {
        const creditExp = new Date(credit.expiresAt).getTime();
        const earliestExp = new Date(earliest).getTime();
        return creditExp < earliestExp ? credit.expiresAt : earliest;
      }, activeCredits[0].expiresAt)
    : null;

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
        {totalActiveAmount > 0 && (
          <div className="mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-900">Available Referral Credit</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {formatCurrency(totalActiveAmount)}
                  </p>
                  {earliestExpiration && (
                    <p className="text-xs text-green-700 mt-1">
                      Credit expires: {formatDate(earliestExpiration)} ({getDaysUntilExpiration(earliestExpiration)} day{getDaysUntilExpiration(earliestExpiration) !== 1 ? 's' : ''} left)
                    </p>
                  )}
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
          Referral credits expire 31 days after issuance. Use them before they expire!
        </p>
      </div>

      {/* Active Credits List */}
      {activeCredits.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Active Credits</h4>
          <div className="space-y-3">
            {activeCredits.map((credit) => {
              const daysLeft = getDaysUntilExpiration(credit.expiresAt);
              const isExpiringSoon = daysLeft <= 7;

              return (
                <div
                  key={credit.id}
                  className={`border rounded-lg p-4 ${
                    isExpiringSoon
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(credit.remainingAmountCents)}
                        </span>
                        {credit.amountCents !== credit.remainingAmountCents && (
                          <span className="text-sm text-gray-500">
                            of {formatCurrency(credit.amountCents)} used
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Expires:</span>
                          <span className={`font-medium ${getStatusColor(credit)}`}>
                            {formatDate(credit.expiresAt)}
                          </span>
                          {daysLeft > 0 && (
                            <span className={`text-xs ${getStatusColor(credit)}`}>
                              ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
                            </span>
                          )}
                        </div>
                        {credit.referralCode && (
                          <div className="text-xs text-gray-500">
                            Referral code: {credit.referralCode}
                          </div>
                        )}
                      </div>
                    </div>
                    {isExpiringSoon && (
                      <div className="flex-shrink-0 ml-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                          Expiring Soon
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Used Credits */}
      {usedCredits.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Used Credits</h4>
          <div className="space-y-2">
            {usedCredits.map((credit) => (
              <div
                key={credit.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(credit.amountCents)}
                    </span>
                    {credit.usedAt && (
                      <span className="text-xs text-gray-500 ml-2">
                        Used on {formatDate(credit.usedAt)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">Used</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired Credits */}
      {expiredCredits.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Expired Credits</h4>
          <div className="space-y-2">
            {expiredCredits.map((credit) => (
              <div
                key={credit.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-500">
                      {formatCurrency(credit.amountCents)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      Expired on {formatDate(credit.expiresAt)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Expired</span>
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

