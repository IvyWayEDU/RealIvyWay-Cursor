'use client';

import { useState, useEffect } from 'react';
import { getCurrentUserEnabledServices, getCurrentUserId } from '@/lib/sessions/actions';
import type { ProviderAvailability, DayAvailability, TimeRangeMinutes as TimeRange } from '@/lib/availability/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DayAvailabilityState {
  enabled: boolean;
  timeRanges: Array<{ start: string; end: string }>; // HH:MM format
}

export default function AvailabilityManagementClient() {
  const [availability, setAvailability] = useState<DayAvailabilityState[]>(
    Array.from({ length: 7 }, () => ({ enabled: false, timeRanges: [{ start: '', end: '' }] }))
  );
  const [providerId, setProviderId] = useState<string | null>(null);
  const [enabledServices, setEnabledServices] = useState<string[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get current provider's user ID on mount
  useEffect(() => {
    const fetchProviderId = async () => {
      const { userId, error } = await getCurrentUserId();
      if (error || !userId) {
        console.error('Failed to get provider ID:', error);
        setLoading(false);
        return;
      }
      setProviderId(userId);
      const servicesResult = await getCurrentUserEnabledServices();
      if (servicesResult?.services?.length) {
        setEnabledServices(servicesResult.services);
        const initialService = servicesResult.services[0];
        setSelectedServiceType((prev) => prev ?? initialService);
        await loadAvailability(initialService);
        setLoading(false);
        return;
      }
      setLoading(false);
    };
    fetchProviderId();
  }, []);

  const loadAvailability = async (serviceTypeOverride?: string) => {
    const st = serviceTypeOverride || selectedServiceType;
    if (!st) return;
    try {
      const params = new URLSearchParams({ serviceType: st });
      const response = await fetch(`/api/availability?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const entry = data?.availability as any;
        const daysPayload: DayAvailability[] | null = Array.isArray(entry?.days) ? (entry.days as DayAvailability[]) : null;
        const blocksPayload: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> | null =
          Array.isArray(entry?.blocks) ? (entry.blocks as any) : null;

        const daysForUi: DayAvailability[] | null =
          daysPayload ||
          (blocksPayload
            ? Array.from({ length: 7 }, (_, dayOfWeek) => {
                const ranges = blocksPayload
                  .filter((b) => Number((b as any).dayOfWeek) === dayOfWeek)
                  .map((b) => ({ startMinutes: Number((b as any).startMinutes), endMinutes: Number((b as any).endMinutes) }));
                return { dayOfWeek, enabled: ranges.length > 0, timeRanges: ranges };
              })
            : null);

        if (daysForUi && Array.isArray(daysForUi)) {
          // Convert from storage format to UI format
          const newAvailability: DayAvailabilityState[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
            const dayData = daysForUi.find((d) => d.dayOfWeek === dayOfWeek);
            if (dayData && dayData.enabled && Array.isArray(dayData.timeRanges) && dayData.timeRanges.length > 0) {
              return {
                enabled: true,
                timeRanges: dayData.timeRanges.map((range: TimeRange) => ({
                  start: minutesToTime(range.startMinutes),
                  end: minutesToTime(range.endMinutes),
                })),
              };
            }
            return { enabled: false, timeRanges: [{ start: '', end: '' }] };
          });
          setAvailability(newAvailability);
        }
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  // Refetch when serviceType changes (only re-init from API on refetch).
  useEffect(() => {
    if (!providerId || !selectedServiceType) return;
    loadAvailability(selectedServiceType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, selectedServiceType]);

  // Convert minutes since midnight to HH:MM format
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Convert HH:MM format to minutes since midnight
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const toggleDay = (dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, enabled: !d.enabled } : d))
    );
    setSaveMessage(null);
  };

  const updateTimeRange = (
    dayIndex: number,
    rangeIndex: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setAvailability((prev) => {
      return prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const updatedRanges = d.timeRanges.map((range, idx) =>
          idx === rangeIndex ? { ...range, [field]: value } : range
        );
        return { ...d, timeRanges: updatedRanges };
      });
    });
    setSaveMessage(null);
  };

  const addTimeRange = (dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, timeRanges: [...d.timeRanges, { start: '09:00', end: '17:00' }] } : d
      )
    );
  };

  const removeTimeRange = (dayIndex: number, rangeIndex: number) => {
    setAvailability((prev) => {
      return prev.map((d, i) => {
        if (i !== dayIndex) return d;
        if (d.timeRanges.length <= 1) return d; // Keep at least one range
        const updatedRanges = d.timeRanges.filter((_, idx) => idx !== rangeIndex);
        return { ...d, timeRanges: updatedRanges };
      });
    });
  };

  const validateTimeRanges = (dayIndex: number): string | null => {
    const dayData = availability[dayIndex];
    if (!dayData.enabled) return null;

    for (const range of dayData.timeRanges) {
      const startMinutes = timeToMinutes(range.start);
      const endMinutes = timeToMinutes(range.end);

      // Check start < end
      if (startMinutes >= endMinutes) {
        return `${DAY_NAMES[dayIndex]}: Start time must be before end time`;
      }
    }

    // Check for overlaps
    const sortedRanges = [...dayData.timeRanges].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    for (let i = 0; i < sortedRanges.length - 1; i++) {
      const currentEnd = timeToMinutes(sortedRanges[i].end);
      const nextStart = timeToMinutes(sortedRanges[i + 1].start);
      if (currentEnd > nextStart) {
        return `${DAY_NAMES[dayIndex]}: Time ranges cannot overlap`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    if (!providerId) {
      setSaveMessage({ type: 'error', text: 'Provider ID not found. Please refresh the page.' });
      return;
    }
    if (!selectedServiceType) {
      setSaveMessage({ type: 'error', text: 'Please select a service type before saving.' });
      return;
    }

    // Validate all enabled days
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const error = validateTimeRanges(dayIndex);
      if (error) {
        setSaveMessage({ type: 'error', text: error });
        return;
      }
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // Convert UI format to storage format
      const days: DayAvailability[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
        const dayData = availability[dayOfWeek];
        return {
          dayOfWeek,
          enabled: Boolean(dayData?.enabled),
          timeRanges: dayData?.enabled
            ? dayData.timeRanges.map((range) => ({
                startMinutes: timeToMinutes(range.start),
                endMinutes: timeToMinutes(range.end),
              }))
            : [],
        };
      });

      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: selectedServiceType,
          days,
          timezone: 'America/New_York',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save availability');
      }

      setSaveMessage({ type: 'success', text: 'Availability saved successfully!' });

      // Re-sync UI from server source-of-truth (avoid relying on local state as a cache)
      await loadAvailability();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving availability:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save availability. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0088CB]"></div>
        <p className="mt-4 text-sm text-gray-500">Loading availability...</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Weekly Availability</h2>
          <p className="mt-1 text-sm text-gray-500">
            Set your available days and times. You can add multiple time slots per day.
          </p>
        </div>
        {enabledServices.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Service</label>
            <select
              value={selectedServiceType || ''}
              onChange={(e) => setSelectedServiceType(e.target.value || null)}
              className="rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] text-sm py-2 px-3"
            >
              {enabledServices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
      <div className="p-6">
        {saveMessage && (
          <div
            className={`mb-4 rounded-md p-4 ${
              saveMessage.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {saveMessage.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-medium ${
                    saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {saveMessage.text}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {DAY_NAMES.map((dayName, dayIndex) => {
            const dayData = availability[dayIndex];
            return (
              <div
                key={dayName}
                className={`border rounded-lg p-4 ${
                  dayData.enabled
                    ? 'border-[#0088CB] bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dayData.enabled}
                      onChange={() => toggleDay(dayIndex)}
                      className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
                    />
                    <span
                      className={`ml-3 text-sm font-medium ${
                        dayData.enabled ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {dayName}
                    </span>
                  </label>
                </div>

                {dayData.enabled && (
                  <div className="ml-7 space-y-3">
                    {dayData.timeRanges.map((range, rangeIndex) => (
                      <div key={rangeIndex} className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">From:</label>
                          <input
                            type="time"
                            value={range.start}
                            onChange={(e) => updateTimeRange(dayIndex, rangeIndex, 'start', e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">To:</label>
                          <input
                            type="time"
                            value={range.end}
                            onChange={(e) => updateTimeRange(dayIndex, rangeIndex, 'end', e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] text-sm"
                          />
                        </div>
                        {dayData.timeRanges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTimeRange(dayIndex, rangeIndex)}
                            className="ml-auto text-sm text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addTimeRange(dayIndex)}
                      className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
                    >
                      + Add another time slot
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

