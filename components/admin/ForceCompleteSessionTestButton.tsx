'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForceCompleteSessionTestButton(props: {
  sessionId: string;
  sessionStatus?: string;
}) {
  const { sessionId, sessionStatus } = props;
  const router = useRouter();

  const isTerminal = sessionStatus === 'cancelled';
  const isAlreadyCompleted = sessionStatus === 'completed';

  const [open, setOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonLabel = useMemo(() => {
    if (isAlreadyCompleted) return 'Force Complete Session Test (Already Completed)';
    return 'Force Complete Session Test';
  }, [isAlreadyCompleted]);

  const onConfirm = async () => {
    setIsWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sessions/force-complete-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to force complete session.');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('Failed to force complete session.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isWorking || isTerminal}
        className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isWorking ? 'Forcing completion...' : buttonLabel}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Test Override</h3>
              <p className="mt-1 text-sm text-gray-600">
                This will mark the session as completed, credit provider earnings, and set{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">completed_by_admin_test=true</code>.
              </p>
            </div>
            <div className="px-6 py-4 space-y-2">
              <div className="text-sm text-gray-700">
                <div className="font-medium">Session ID</div>
                <div className="mt-1 font-mono text-xs break-all">{sessionId}</div>
              </div>
              {isAlreadyCompleted && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  This session is already completed. The handler is idempotent; earnings will not be double-credited.
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isWorking}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isWorking}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isWorking ? 'Working...' : 'Yes, force complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



