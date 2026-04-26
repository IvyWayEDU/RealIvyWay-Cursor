export function getFirstName(displayName: string | null | undefined): string | null {
  const raw = (displayName ?? '').trim();
  if (!raw) return null;

  // Handle "Last, First" formats.
  const commaParts = raw.split(',');
  const preferred = (commaParts.length > 1 ? commaParts[1] : raw).trim();
  if (!preferred) return null;

  const first = preferred.split(/\s+/).filter(Boolean)[0];
  return first ?? null;
}

