'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ga4Event, ga4Pageview } from '@/lib/analytics/ga4';

function safeParseJson(input: string | null): Record<string, any> | null {
  if (!input) return null;
  try {
    const v = JSON.parse(input);
    return v && typeof v === 'object' ? (v as Record<string, any>) : null;
  } catch {
    return null;
  }
}

export default function GA4Client() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track pageviews on App Router navigation.
  useEffect(() => {
    const qs = searchParams?.toString();
    const url = `${pathname || '/'}${qs ? `?${qs}` : ''}`;
    ga4Pageview(url);
  }, [pathname, searchParams]);

  // Lightweight click listener for declarative event tracking.
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.closest) return;

      const el = target.closest('[data-ga-event]') as HTMLElement | null;
      if (!el) return;

      const eventName = el.getAttribute('data-ga-event');
      if (!eventName) return;

      const label = el.getAttribute('data-ga-label') || undefined;
      const params = safeParseJson(el.getAttribute('data-ga-params')) || {};

      ga4Event(eventName, {
        ...(label ? { event_label: label } : null),
        ...params,
      });
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return null;
}

