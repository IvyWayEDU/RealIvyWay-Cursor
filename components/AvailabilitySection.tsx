'use client';

import { useState, useEffect } from 'react';
import { getCurrentUserId } from '@/lib/sessions/actions';
import { addDevSession, removeDevSessionsByProviderIdAndStatus } from '@/lib/devSessionStore';
import { Session } from '@/lib/models/types';

interface TimeRange {
  start: string;
  end: string;
}

interface DayAvailability {
  day: string;
  enabled: boolean;
  timeRanges: TimeRange[];
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Generate UUID for browser
 */
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the day of week index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
function getDayOfWeekIndex(dayName: string): number {
  const dayMap: { [key: string]: number } = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };
  return dayMap[dayName] ?? 1;
}

export default function AvailabilitySection() {
  const [availability, setAvailability] = useState<DayAvailability[]>(
    DAYS_OF_WEEK.map((day) => ({
      day,
      enabled: false,
      timeRanges: [{ start: '09:00', end: '17:00' }],
    }))
  );
  const [providerId, setProviderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasAnyAvailability = availability.some((day) => day.enabled);

  // Get current provider's user ID on mount
  useEffect(() => {
    const fetchProviderId = async () => {
      const { userId, error } = await getCurrentUserId();
      if (error || !userId) {
        console.error('Failed to get provider ID:', error);
        return;
      }
      setProviderId(userId);
    };
    fetchProviderId();
  }, []);

  const toggleDay = (dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex ? { ...day, enabled: !day.enabled } : day
      )
    );
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
          const updatedRanges = day.timeRanges.map((range, rIdx) =>
            rIdx === rangeIndex ? { ...range, [field]: value } : range
          );
          return { ...day, timeRanges: updatedRanges };
        }
        return day;
      })
    );
  };

  const addTimeRange = (dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex
          ? {
              ...day,
              timeRanges: [...day.timeRanges, { start: '09:00', end: '17:00' }],
            }
          : day
      )
    );
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
            timeRanges: updatedRanges.length > 0 ? updatedRanges : [{ start: '09:00', end: '17:00' }],
          };
        }
        return day;
      })
    );
  };

  /**
   * Create availability slots for the next 4 weeks based on provider's availability settings
   * Each slot is stored as a session with status='available' and providerId = provider's auth.user.id
   */
  const handleSaveAvailability = async () => {
    if (!providerId) {
      setSaveMessage({ type: 'error', text: 'Provider ID not found. Please refresh the page.' });
      return;
    }

    if (!hasAnyAvailability) {
      setSaveMessage({ type: 'error', text: 'Please enable at least one day with time ranges.' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // Remove old availability slots for this provider (we'll recreate them)
      // This ensures we don't have duplicate slots when provider updates availability
      removeDevSessionsByProviderIdAndStatus(providerId, 'available');

      const now = new Date();
      const newSlots: Session[] = [];

      // Generate slots for the next 4 weeks
      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        for (const dayAvailability of availability) {
          if (!dayAvailability.enabled) continue;

          const dayIndex = getDayOfWeekIndex(dayAvailability.day);
          
          // Find the next occurrence of this day
          const targetDate = new Date(now);
          const daysUntilTarget = (dayIndex - now.getDay() + 7) % 7;
          targetDate.setDate(now.getDate() + daysUntilTarget + (weekOffset * 7));
          
          // Create a slot for each time range
          for (const timeRange of dayAvailability.timeRanges) {
            const [startHour, startMinute] = timeRange.start.split(':').map(Number);
            const [endHour, endMinute] = timeRange.end.split(':').map(Number);
            
            const slotStart = new Date(targetDate);
            slotStart.setHours(startHour, startMinute, 0, 0);
            
            const slotEnd = new Date(targetDate);
            slotEnd.setHours(endHour, endMinute, 0, 0);
            
            // Only create slots in the future
            if (slotStart > now) {
              const newSlot: Session = {
                id: generateUUID(),
                studentId: '', // Empty for available sessions
                providerId: providerId, // CRITICAL: Use provider's auth.user.id
                serviceTypeId: 'tutoring', // Default, can be customized later
                sessionType: 'tutoring', // Default, can be customized later
                scheduledStartTime: slotStart.toISOString(),
                scheduledEndTime: slotEnd.toISOString(),
                status: 'available',
                priceCents: 6900, // Default $69, can be customized later
                amountChargedCents: 0,
                amountRefundedCents: 0,
                bookedAt: '',
                bookedBy: '',
                availabilityId: `availability-${generateUUID()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              newSlots.push(newSlot);
              addDevSession(newSlot);
            }
          }
        }
      }

      setSaveMessage({ 
        type: 'success', 
        text: `Successfully created ${newSlots.length} availability slots for the next 4 weeks.` 
      });
    } catch (error) {
      console.error('Error saving availability:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save availability. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Availability</h2>
          <p className="mt-1 text-sm text-gray-500">
            Set your available days and times for sessions. Slots will be created for the next 4 weeks.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveAvailability}
          disabled={saving || !hasAnyAvailability || !providerId}
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
            'Save Availability'
          )}
        </button>
      </div>
      <div className="p-6">
        {saveMessage && (
          <div className={`mb-4 rounded-md p-4 ${
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
        
        {!hasAnyAvailability ? (
          <div className="text-center py-12">
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
        ) : null}

        <div className="space-y-4">
          {availability.map((day, dayIndex) => (
            <div
              key={day.day}
              className={`border rounded-lg p-4 ${
                day.enabled
                  ? 'border-indigo-200 bg-indigo-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => toggleDay(dayIndex)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span
                    className={`ml-3 text-sm font-medium ${
                      day.enabled ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {day.day}
                  </span>
                </label>
              </div>

              {day.enabled && (
                <div className="ml-7 space-y-3">
                  {day.timeRanges.map((range, rangeIndex) => (
                    <div
                      key={rangeIndex}
                      className="flex items-center gap-3 flex-wrap"
                    >
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">From:</label>
                        <input
                          type="time"
                          value={range.start}
                          onChange={(e) =>
                            updateTimeRange(
                              dayIndex,
                              rangeIndex,
                              'start',
                              e.target.value
                            )
                          }
                          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">To:</label>
                        <input
                          type="time"
                          value={range.end}
                          onChange={(e) =>
                            updateTimeRange(
                              dayIndex,
                              rangeIndex,
                              'end',
                              e.target.value
                            )
                          }
                          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      {day.timeRanges.length > 1 && (
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
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Add another time range
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

