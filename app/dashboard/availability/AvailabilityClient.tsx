'use client';

import { useState, useEffect } from 'react';
import { getCurrentUserEnabledServices, getCurrentUserId } from '@/lib/sessions/actions';

interface TimeRange {
  start: string; // HH:mm format (local time, for display)
  end: string; // HH:mm format (local time, for display)
}

interface DayAvailability {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  enabled: boolean;
  timeRanges: TimeRange[];
}

interface ProviderAvailability {
  providerId: string;
  days: DayAvailability[];
  updatedAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type AvailabilityApiEntry = {
  providerId: string;
  serviceType: string;
  timezone: string;
  updatedAt: string;
  days: DayAvailability[] | null;
  blocks: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> | null;
};

function blocksToDaysForUi(
  blocks: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }>
): DayAvailability[] {
  const days: DayAvailability[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: false,
    timeRanges: [{ start: '', end: '' }],
  }));

  for (const b of blocks || []) {
    const dow = Number((b as any).dayOfWeek);
    const startMinutes = Number((b as any).startMinutes);
    const endMinutes = Number((b as any).endMinutes);
    if (!Number.isFinite(dow) || dow < 0 || dow > 6) continue;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) continue;
    days[dow].enabled = true;

    // Convert minutes to HH:mm for UI-only initialization
    const startH = Math.floor(startMinutes / 60);
    const startM = startMinutes % 60;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const start = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const current = days[dow].timeRanges;
    // If the day was previously empty (one blank range), replace it.
    if (current.length === 1 && !current[0].start && !current[0].end) {
      days[dow].timeRanges = [{ start, end }];
    } else {
      days[dow].timeRanges.push({ start, end });
    }
  }

  return days;
}


/**
 * Generate time options in 15-minute increments (HH:MM format)
 */
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push(timeStr);
    }
  }
  return options;
}

/**
 * Convert HH:MM to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format time for display (12-hour format with AM/PM)
 */
function formatTimeDisplay(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Validate that time ranges don't overlap and have valid start/end times
 */
function validateTimeRanges(timeRanges: TimeRange[]): { valid: boolean; error?: string } {
  // Check each range has valid start and end
  for (const range of timeRanges) {
    if (!range.start || !range.end) {
      return { valid: false, error: 'Start and end times are required' };
    }
    
    const startMin = timeToMinutes(range.start);
    const endMin = timeToMinutes(range.end);
    
    if (endMin <= startMin) {
      return { valid: false, error: `End time must be after start time: ${range.start}-${range.end}` };
    }
  }
  
  if (timeRanges.length <= 1) {
    return { valid: true };
  }

  // Sort by start time
  const sorted = [...timeRanges].sort((a, b) => {
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  });

  // Check for overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    const currentStart = timeToMinutes(current.start);
    const currentEnd = timeToMinutes(current.end);
    const nextStart = timeToMinutes(next.start);
    
    if (currentEnd > nextStart) {
      return { 
        valid: false, 
        error: `Time ranges overlap: ${current.start}-${current.end} overlaps with ${next.start}-${next.end}` 
      };
    }
  }

  return { valid: true };
}

export default function AvailabilityClient() {
  const [availability, setAvailability] = useState<DayAvailability[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      enabled: false,
      timeRanges: [{ start: '', end: '' }],
    }))
  );
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [enabledServices, setEnabledServices] = useState<string[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);

  // Load providerId on mount
  useEffect(() => {
    const loadProviderId = async () => {
      const { userId } = await getCurrentUserId();
      setProviderId(userId);
      const servicesResult = await getCurrentUserEnabledServices();
      if (servicesResult?.services?.length) {
        setEnabledServices(servicesResult.services);
        setSelectedServiceType((prev) => prev ?? servicesResult.services[0]);
      }
    };
    loadProviderId();
  }, []);

  // Load saved availability when providerId + selectedServiceType are loaded.
  // IMPORTANT: Form state should only be initialized from API responses (on fetch), not implicitly.
  useEffect(() => {
    if (!providerId || !selectedServiceType) return; // Wait for providerId + serviceType
    
    const loadAvailability = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ serviceType: selectedServiceType });
        const response = await fetch(`/api/availability?${params.toString()}`);
        const data = (await response.json()) as { availability: AvailabilityApiEntry | null; error?: string };

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load availability');
        }

        const entry = data.availability;
        if (!entry) {
          // No stored availability for this provider+serviceType => EMPTY (do not auto-create).
          setAvailability(
            Array.from({ length: 7 }, (_, i) => ({
              dayOfWeek: i,
              enabled: false,
              timeRanges: [{ start: '', end: '' }],
            }))
          );
        } else if (entry.days && Array.isArray(entry.days)) {
          // Initialize from API response (exact stored payload)
          setAvailability(entry.days);
        } else if (entry.blocks && Array.isArray(entry.blocks)) {
          // Legacy: API returns stored blocks (days=null). Convert to UI-only days.
          setAvailability(blocksToDaysForUi(entry.blocks));
        } else {
          setAvailability(
            Array.from({ length: 7 }, (_, i) => ({
              dayOfWeek: i,
              enabled: false,
              timeRanges: [{ start: '', end: '' }],
            }))
          );
        }
      } catch (error) {
        console.error('Error loading availability:', error);
        setSaveMessage({ 
          type: 'error', 
          text: 'Failed to load availability. Please refresh the page.' 
        });
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [providerId, selectedServiceType]);

  const toggleDay = (dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex ? { ...day, enabled: !day.enabled } : day
      )
    );
    setSaveMessage(null);
  };

  const updateTimeRange = (
    dayIndex: number,
    rangeIndex: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setAvailability((prev) =>
      prev.map((day, dIdx) => {
        if (dIdx === dayIndex) {
          const updatedRanges = day.timeRanges.map((range, rIdx) => {
            if (rIdx === rangeIndex) {
              const updated = { ...range, [field]: value };
              // If start time changes and end time exists, validate it's still after start time
              if (field === 'start' && value && updated.end) {
                try {
                  const startMin = timeToMinutes(value);
                  const endMin = timeToMinutes(updated.end);
                  if (endMin <= startMin) {
                    updated.end = '';
                  }
                } catch (e) {
                  // If parsing fails, clear end time
                  updated.end = '';
                }
              }
              return updated;
            }
            return range;
          });
          return { ...day, timeRanges: updatedRanges };
        }
        return day;
      })
    );
    setSaveMessage(null);
  };

  const addTimeRange = (dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex
          ? {
              ...day,
              timeRanges: [...day.timeRanges, { start: '', end: '' }],
            }
          : day
      )
    );
    setSaveMessage(null);
  };

  const removeTimeRange = (dayIndex: number, rangeIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) => {
        if (idx === dayIndex) {
          const updatedRanges = day.timeRanges.filter(
            (_, rIdx) => rIdx !== rangeIndex
          );
          return {
            ...day,
            timeRanges: updatedRanges.length > 0 ? updatedRanges : [{ start: '', end: '' }],
          };
        }
        return day;
      })
    );
    setSaveMessage(null);
  };

  const handleSave = async () => {
    // Validate providerId is available
    if (!providerId) {
      setSaveMessage({ 
        type: 'error', 
        text: 'Provider ID not loaded. Please refresh the page.' 
      });
      return;
    }
    if (!selectedServiceType) {
      setSaveMessage({
        type: 'error',
        text: 'Please select a service type before saving.',
      });
      return;
    }

    // Validate all enabled days have valid, non-overlapping time ranges
    for (let i = 0; i < availability.length; i++) {
      const day = availability[i];
      if (day.enabled) {
        const validation = validateTimeRanges(day.timeRanges);
        if (!validation.valid) {
          setSaveMessage({ 
            type: 'error', 
            text: `${DAY_NAMES[i]}: ${validation.error}` 
          });
          return;
        }
      }
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const requestBody = {
        timezone: 'America/New_York',
        serviceType: selectedServiceType,
        days: availability,
      };

      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result?.error || result?.details || 'Failed to save availability';
        throw new Error(errorMessage);
      }
      
      // After successful save, update local state from server response
      // DO NOT clear state - only update from server response
      if (result?.availability?.days && Array.isArray(result.availability.days)) {
        setAvailability(result.availability.days);
        setSaveMessage({ 
          type: 'success', 
          text: 'Saved' 
        });
      } else {
        // Server returned null availability (shouldn't happen on save, but handle gracefully)
        setSaveMessage({ 
          type: 'success', 
          text: 'Saved' 
        });
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving availability:', error);
      setSaveMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save availability. Please try again.' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!providerId) {
      setSaveMessage({ 
        type: 'error', 
        text: 'Provider ID not loaded. Please refresh the page.' 
      });
      return;
    }
    if (!selectedServiceType) {
      setSaveMessage({
        type: 'error',
        text: 'Please select a service type before clearing.',
      });
      return;
    }

    setClearing(true);
    setSaveMessage(null);

    try {
      const requestBody = {
        intent: 'clear',
        timezone: 'America/New_York',
        serviceType: selectedServiceType,
      };

      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result?.error || result?.details || 'Failed to clear availability';
        throw new Error(errorMessage);
      }
      
      // Clear local state on explicit clear
      setAvailability(
        Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          enabled: false,
          timeRanges: [{ start: '', end: '' }],
        }))
      );
      setSaveMessage({ 
        type: 'success', 
        text: 'Availability cleared' 
      });
      
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error clearing availability:', error);
      setSaveMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to clear availability. Please try again.' 
      });
    } finally {
      setClearing(false);
    }
  };

  const hasAnyAvailability = availability.some((day) => day.enabled);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="mx-auto h-8 w-8 animate-spin text-[#0088CB]"
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
          <p className="mt-4 text-sm text-gray-600">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Availability</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set your weekly availability per service type. Availability only changes when you press Save.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing || saving || !selectedServiceType}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing...' : 'Clear'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || clearing || !selectedServiceType}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
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
              'Save'
            )}
          </button>
          </div>
        </div>
      </div>


      {/* Save Message */}
      {saveMessage && (
        <div className={`rounded-md p-4 ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {saveMessage.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {saveMessage.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasAnyAvailability && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No availability set
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select days and times below to set your availability.
          </p>
        </div>
      )}

      {/* Days List */}
      <div className="space-y-4">
        {availability.map((day, dayIndex) => (
          <div
            key={day.dayOfWeek}
            className={`border rounded-lg p-4 transition-colors ${
              day.enabled
                ? 'border-[#0088CB] bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={() => toggleDay(dayIndex)}
                  className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
                />
                <span
                  className={`ml-3 text-sm font-medium ${
                    day.enabled ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
              </label>
            </div>

            {day.enabled && (
              <div className="ml-7 space-y-3">
                {day.timeRanges.map((range, rangeIndex) => {
                  const validation = validateTimeRanges(day.timeRanges);
                  const hasError = !validation.valid;
                  const timeOptions = generateTimeOptions();
                  
                  // Filter end time options to be greater than start time
                  const endTimeOptions = range.start 
                    ? timeOptions.filter(opt => timeToMinutes(opt) > timeToMinutes(range.start))
                    : timeOptions;
                  
                  return (
                    <div key={rangeIndex} className="space-y-2">
                      <div
                        className={`flex items-center gap-3 flex-wrap p-3 rounded-lg ${
                          hasError ? 'bg-red-50 border border-red-200' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Start:</label>
                          <select
                            value={range.start || ''}
                            onChange={(e) =>
                              updateTimeRange(
                                dayIndex,
                                rangeIndex,
                                'start',
                                e.target.value
                              )
                            }
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] text-sm py-1.5"
                          >
                            <option value="">Select start time</option>
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {formatTimeDisplay(time)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">End:</label>
                          <select
                            value={range.end || ''}
                            onChange={(e) =>
                              updateTimeRange(
                                dayIndex,
                                rangeIndex,
                                'end',
                                e.target.value
                              )
                            }
                            disabled={!range.start}
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] text-sm py-1.5 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">Select end time</option>
                            {endTimeOptions.map((time) => (
                              <option key={time} value={time}>
                                {formatTimeDisplay(time)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {day.timeRanges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTimeRange(dayIndex, rangeIndex)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {range.start && range.end && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#0088CB] text-white">
                            {formatTimeDisplay(range.start)} - {formatTimeDisplay(range.end)}
                          </span>
                        </div>
                      )}
                      {hasError && (
                        <div className="text-xs text-red-600 mt-1">
                          {validation.error}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addTimeRange(dayIndex)}
                  className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
                >
                  + Add another time range
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
