'use client';

import { useState } from 'react';

export default function ClearDevSessionsButton() {
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all dev sessions? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/dev/clear-sessions', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Successfully cleared ${data.deletedCount || 0} sessions.`);
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage(data.error || 'Failed to clear sessions.');
      }
    } catch (error) {
      console.error('Error clearing sessions:', error);
      setMessage('An error occurred while clearing sessions.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClear}
        disabled={isClearing}
        className="w-full rounded-md border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isClearing ? 'Clearing...' : 'Clear Dev Sessions'}
      </button>
      {message && (
        <div className={`mt-2 text-sm ${message.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

