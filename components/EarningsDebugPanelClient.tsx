'use client';

import { useEffect, useState } from 'react';

export default function EarningsDebugPanelClient() {
  const [json, setJson] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch('/api/provider/earnings/summary', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();
        if (cancelled) return;
        setJson(data);
        setError(!res.ok ? String((data as any)?.error || `HTTP ${res.status}`) : null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch earnings summary');
      }
    }

    run().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-2 text-xs font-semibold text-gray-700">Earnings Debug (raw `/api/provider/earnings/summary`)</div>
      {error ? <div className="mb-2 text-xs text-red-700">Error: {error}</div> : null}
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(json, null, 2)}</pre>
    </div>
  );
}


