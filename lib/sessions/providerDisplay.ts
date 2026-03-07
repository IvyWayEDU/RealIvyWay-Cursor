export const UNKNOWN_PROVIDER_DISPLAY_NAME = 'Unknown Provider';

export function normalizeProviderId(providerId: unknown): string | null {
  if (typeof providerId !== 'string') return null;
  const id = providerId.trim();
  return id.length > 0 ? id : null;
}

export function resolveProviderDisplayName(
  providerId: unknown,
  nameById: Record<string, string | undefined>
): string {
  const id = normalizeProviderId(providerId);
  if (!id) return UNKNOWN_PROVIDER_DISPLAY_NAME;
  const name = nameById[id];
  return typeof name === 'string' && name.trim().length > 0 ? name : UNKNOWN_PROVIDER_DISPLAY_NAME;
}



