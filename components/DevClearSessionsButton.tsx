'use client';

import { useState } from 'react';

export default function DevClearSessionsButton() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const [isClearing, setIsClearing] = useState(false);

  return (
    <div className="mb-6 rounded border border-red-400 bg-red-50 p-4">
      <p className="mb-2 text-sm text-red-700 font-semibold">
        Development Tools
      </p>
      <button
        onClick={async () => {
          if (!confirm('Are you sure you want to clear all sessions and availability bookings? This will not affect users/providers.')) {
            return;
          }
          setIsClearing(true);
          try {
            await fetch('/api/dev/clear-sessions', { method: 'POST' });
            window.location.reload();
          } finally {
            setIsClearing(false);
          }
        }}
        disabled={isClearing}
        className="rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
      >
        {isClearing ? 'Clearing…' : 'Dev: Clear Sessions'}
      </button>
    </div>
  );
}


