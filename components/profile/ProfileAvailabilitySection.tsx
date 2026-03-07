'use client';

import { useState, useImperativeHandle, forwardRef } from 'react';
import type { ProviderAvailability, DayAvailability } from '@/lib/availability/types';

interface TimeRange {
  start: string;
  end: string;
}

interface DayAvailabilityUI {
  day: string;
  enabled: boolean;
  timeRanges: TimeRange[];
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface ProfileAvailabilitySectionProps {
  initialAvailability?: ProviderAvailability;
}

export interface ProfileAvailabilitySectionRef {
  getAvailability: () => ProviderAvailability;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM format to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const ProfileAvailabilitySection = forwardRef<ProfileAvailabilitySectionRef, ProfileAvailabilitySectionProps>(
  ({ initialAvailability }, ref) => {
    // Initialize state from existing availability or defaults
    const [availability, setAvailability] = useState<DayAvailabilityUI[]>(() => {
      if (initialAvailability?.days && initialAvailability.days.length === 7) {
        // Map dayOfWeek (0=Sunday, 1=Monday, etc.) to day name
        return DAYS_OF_WEEK.map((dayName, index) => {
          // Find the day data that matches this dayOfWeek
          const dayData = initialAvailability.days.find(d => d.dayOfWeek === index);
          return {
            day: dayName,
            enabled: dayData?.enabled || false,
            timeRanges: dayData?.timeRanges?.map(range => ({
              start: minutesToTime(range.startMinutes),
              end: minutesToTime(range.endMinutes),
            })) || [{ start: '09:00', end: '17:00' }],
          };
        });
      }
      return DAYS_OF_WEEK.map((day) => ({
        day,
        enabled: false,
        timeRanges: [{ start: '09:00', end: '17:00' }],
      }));
    });

    // Expose method to get current availability (called only on Save)
    useImperativeHandle(ref, () => ({
      getAvailability: (): ProviderAvailability => {
        return {
          providerId: initialAvailability?.providerId || '', // Preserve providerId if available
          days: availability.map((day) => ({
            dayOfWeek: DAYS_OF_WEEK.indexOf(day.day),
            enabled: day.enabled,
            timeRanges: day.timeRanges.map(range => ({
              startMinutes: timeToMinutes(range.start),
              endMinutes: timeToMinutes(range.end),
            })),
          })),
          updatedAt: new Date().toISOString(),
        };
      },
    }), [availability, initialAvailability]);

    const hasAnyAvailability = availability.some((day) => day.enabled);

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

    return (
    <div className="space-y-4">
      {!hasAnyAvailability && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
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
  );
  }
);

ProfileAvailabilitySection.displayName = 'ProfileAvailabilitySection';

export default ProfileAvailabilitySection;