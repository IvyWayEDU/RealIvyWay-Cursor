'use client';

import { useEffect } from 'react';
import { ga4Event } from '@/lib/analytics/ga4';

export default function TrackEventOnMount(props: { name: string; params?: Record<string, any> }) {
  useEffect(() => {
    ga4Event(props.name, props.params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

