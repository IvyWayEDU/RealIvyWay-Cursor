'use client';

import { useState, useEffect } from 'react';
import { PlatformFee, PlatformFeesConfig } from '@/lib/platform-fees/types';

interface PlatformFeesSectionProps {
  initialConfig: PlatformFeesConfig;
}

export default function PlatformFeesSection({ initialConfig }: PlatformFeesSectionProps) {
  const [config, setConfig] = useState<PlatformFeesConfig>(initialConfig);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ calculationType: 'flat' | 'percentage'; amountCents: number; percentage: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleEdit = (fee: PlatformFee) => {
    setEditingFeeId(fee.id);
    setEditValues({
      calculationType: fee.calculationType,
      amountCents: fee.amountCents,
      percentage: fee.percentage,
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingFeeId(null);
    setEditValues(null);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async (feeId: string) => {
    if (!editValues) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/platform-fees', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feeId,
          calculationType: editValues.calculationType,
          amountCents: editValues.calculationType === 'flat' ? editValues.amountCents : 0,
          percentage: editValues.calculationType === 'percentage' ? editValues.percentage : 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update platform fee');
      }

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      setEditingFeeId(null);
      setEditValues(null);
      setSuccess('Platform fee updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update platform fee');
    } finally {
      setIsSaving(false);
    }
  };

  const formatServiceType = (serviceType: PlatformFee['serviceType']): string => {
    switch (serviceType) {
      case 'tutoring':
        return 'Tutoring';
      case 'test-prep':
        return 'Test Prep';
      case 'college-counseling':
        return 'College Counseling';
      case 'virtual-tours':
        return 'Virtual Tours';
      default:
        return serviceType;
    }
  };

  const formatPlanType = (planType: PlatformFee['planType']): string => {
    switch (planType) {
      case 'single-session':
        return 'Single Session';
      case 'monthly-package':
        return 'Monthly Package';
      case 'counseling-single':
        return 'Single (60 min)';
      case 'counseling-monthly':
        return 'Monthly Plan';
      case 'single-tour':
        return 'Single Tour';
      default:
        return planType;
    }
  };

  const formatFee = (fee: PlatformFee): string => {
    if (fee.calculationType === 'flat') {
      return `$${(fee.amountCents / 100).toFixed(2)}`;
    } else {
      return `${fee.percentage}%`;
    }
  };

  // Group fees by service type
  const groupedFees = config.fees.reduce((acc, fee) => {
    if (!acc[fee.serviceType]) {
      acc[fee.serviceType] = [];
    }
    acc[fee.serviceType].push(fee);
    return acc;
  }, {} as Record<PlatformFee['serviceType'], PlatformFee[]>);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Platform Fees</h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure platform fees for each service and plan type. Changes apply only to future bookings.
            </p>
          </div>
          {config.lastUpdatedAt && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Last updated</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(config.lastUpdatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(groupedFees).map(([serviceType, fees]) => (
            <div key={serviceType} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {formatServiceType(serviceType as PlatformFee['serviceType'])}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plan Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fee Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatPlanType(fee.planType)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {fee.calculationType === 'flat' ? 'Flat Amount' : 'Percentage'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingFeeId === fee.id && editValues ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={editValues.calculationType}
                                onChange={(e) => {
                                  const newType = e.target.value as 'flat' | 'percentage';
                                  setEditValues({
                                    ...editValues,
                                    calculationType: newType,
                                    ...(newType === 'flat' ? { percentage: 0 } : { amountCents: 0 }),
                                  });
                                }}
                                className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="flat">Flat</option>
                                <option value="percentage">Percentage</option>
                              </select>
                              {editValues.calculationType === 'flat' ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={(editValues.amountCents / 100).toFixed(2)}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      setEditValues({
                                        ...editValues,
                                        amountCents: Math.round(value * 100),
                                      });
                                    }}
                                    className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={editValues.percentage}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      setEditValues({
                                        ...editValues,
                                        percentage: Math.min(100, Math.max(0, value)),
                                      });
                                    }}
                                    className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  />
                                  <span className="text-gray-500">%</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            formatFee(fee)
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {editingFeeId === fee.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleSave(fee.id)}
                                disabled={isSaving}
                                className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(fee)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}





