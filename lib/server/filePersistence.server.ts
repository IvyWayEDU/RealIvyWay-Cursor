import 'server-only';

declare global {
  // eslint-disable-next-line no-var
  var __ivywayFilePersistenceWarned: Record<string, true> | undefined;
}

export function isFilePersistenceDisabled(): boolean {
  // Vercel (and similar serverless) deploys the app bundle read-only.
  // Detect Vercel explicitly to preserve localhost behavior (even in NODE_ENV=production).
  return Boolean(process.env.VERCEL) || Boolean(process.env.NOW_REGION);
}

export function warnFilePersistenceDisabled(scope: string, details?: Record<string, unknown>): void {
  if (!isFilePersistenceDisabled()) return;
  const key = String(scope || 'unknown');
  const warned = (globalThis.__ivywayFilePersistenceWarned ||= {});
  if (warned[key]) return;
  warned[key] = true;

  console.warn('[FILE_PERSISTENCE_DISABLED]', {
    scope: key,
    vercel: process.env.VERCEL,
    nowRegion: process.env.NOW_REGION,
    ...(details || {}),
  });
}

