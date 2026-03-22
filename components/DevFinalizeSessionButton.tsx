'use client';

import { useState } from 'react';

type SimulationType = 'provider_no_show' | 'student_no_show' | 'normal';

export default function DevFinalizeSessionButton(props: {
  sessionId: string;
  sessionStatus?: string;
  onFinalized?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const { sessionId, sessionStatus, onFinalized } = props;

  const finalize = async (simulationType: SimulationType) => {
    setIsWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/finalize-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, simulationType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any)?.error || 'Failed to finalize session.');
        return;
      }
      setOpen(false);
      onFinalized?.();
    } catch (e) {
      console.error(e);
      setError('Failed to finalize session.');
    } finally {
      setIsWorking(false);
    }
  };

  const isTerminal = sessionStatus === 'cancelled';

  return (
    <div className="space-y-2 w-full">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isWorking || isTerminal}
        className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isWorking ? 'Working...' : 'Dev: Finalize Session'}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Dev: Finalize Session</h3>
              <p className="mt-1 text-sm text-gray-600">
                This bypasses time checks and uses the same canonical completion/earnings logic.
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="text-sm text-gray-700">
                <div className="font-medium">Session ID</div>
                <div className="mt-1 font-mono text-xs break-all">{sessionId}</div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => finalize('provider_no_show')}
                  disabled={isWorking}
                  className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Simulate Provider No Show
                </button>
                <button
                  type="button"
                  onClick={() => finalize('student_no_show')}
                  disabled={isWorking}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Simulate Student No Show
                </button>
                <button
                  type="button"
                  onClick={() => finalize('normal')}
                  disabled={isWorking}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Simulate Normal Completion
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isWorking}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


