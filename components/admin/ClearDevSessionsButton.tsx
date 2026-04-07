'use client';

import { useState } from 'react';
import { clearSessions } from '@/lib/sessions/devActions';

export default function ClearDevSessionsButton() {
  const [isClearing, setIsClearing] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all dev sessions? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);

    try {
      await clearSessions();
      window.location.reload();
    } catch (error) {
      console.error('Error clearing sessions:', error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClear}
        disabled={isClearing}
        className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isClearing ? 'Clearing...' : 'Clear Dev Sessions'}
      </button>
    </div>
  );
}

