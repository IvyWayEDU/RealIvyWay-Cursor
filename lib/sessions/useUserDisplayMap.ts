'use client';

import { useEffect, useMemo, useState } from 'react';
import { getUserDisplayInfoById } from '@/lib/sessions/actions';

export interface UserDisplayMapResult {
  displayNames: Record<string, string>;
  profileImageUrls: Record<string, string | null>;
  failedIds: Record<string, true>;
  status: 'idle' | 'loading' | 'loaded';
}

function uniqNonEmpty(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function useUserDisplayMap(userIds: Array<string | null | undefined>): UserDisplayMapResult {
  const uniqueIds = useMemo(() => uniqNonEmpty(userIds), [JSON.stringify(userIds)]);
  const key = useMemo(() => uniqueIds.slice().sort().join('|'), [uniqueIds]);

  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [profileImageUrls, setProfileImageUrls] = useState<Record<string, string | null>>({});
  const [failedIds, setFailedIds] = useState<Record<string, true>>({});
  const [status, setStatus] = useState<UserDisplayMapResult['status']>('idle');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!key) {
        setDisplayNames({});
        setProfileImageUrls({});
        setFailedIds({});
        setStatus('loaded');
        return;
      }

      setStatus('loading');

      const names: Record<string, string> = {};
      const images: Record<string, string | null> = {};
      const failed: Record<string, true> = {};

      await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const { displayName, profileImageUrl } = await getUserDisplayInfoById(id);
            if (displayName && displayName.trim()) {
              names[id] = displayName.trim();
              images[id] = profileImageUrl ?? null;
            } else {
              failed[id] = true;
              images[id] = null;
            }
          } catch {
            failed[id] = true;
            images[id] = null;
          }
        })
      );

      if (cancelled) return;
      setDisplayNames(names);
      setProfileImageUrls(images);
      setFailedIds(failed);
      setStatus('loaded');
    };

    run().catch(() => {
      if (cancelled) return;
      setStatus('loaded');
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { displayNames, profileImageUrls, failedIds, status };
}



