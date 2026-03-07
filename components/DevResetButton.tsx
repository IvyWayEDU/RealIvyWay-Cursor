'use client';

/**
 * DEV-ONLY: Clear Upcoming Sessions Button
 * 
 * This component is ONLY available in development mode.
 * It provides a button to clear upcoming sessions (scheduled/paid).
 * 
 * DO NOT USE IN PRODUCTION
 */

import { useState } from 'react';

export default function DevResetButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClearSessions = async () => {
    if (!confirm('Are you sure you want to clear all upcoming sessions? This will mark all scheduled/paid sessions as cancelled_dev.')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/dev/clear-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(`Successfully cleared ${data.clearedCount} upcoming session(s).`);
        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage(`Error: ${data.error || 'Failed to clear sessions'}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900">Dev Tools</h3>
          <p className="mt-1 text-xs text-red-700">
            Clear all sessions. Earnings will go to $0 because earnings are derived from completed sessions.
          </p>
          {message && (
            <p className={`mt-2 text-xs ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </div>
        <button
          onClick={handleClearSessions}
          disabled={isLoading}
          className="ml-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Clearing...' : 'Clear Sessions (DEV)'}
        </button>
      </div>
    </div>
  );
}

