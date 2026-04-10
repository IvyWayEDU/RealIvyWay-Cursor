export const LANGUAGE_TUTORING_OPTIONS = [
  'Spanish',
  'French',
  'Arabic',
  'Chinese (Mandarin)',
  'Hindi',
  'Portuguese',
  'Russian',
  'Japanese',
  'Korean',
  'German',
  'Italian',
] as const;

export type LanguageTutoringOption = (typeof LANGUAGE_TUTORING_OPTIONS)[number];

export function normalizeLanguageTutoringLabel(input: string | null | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  const compact = raw
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Preserve compatibility with older UI values.
  if (compact === 'mandarin' || compact === 'chinese mandarin' || compact === 'chinese') return 'chinese (mandarin)';

  return compact;
}

export function languageTutoringMatches(providerLanguage: string, requestedLanguage: string): boolean {
  const p = normalizeLanguageTutoringLabel(providerLanguage);
  const r = normalizeLanguageTutoringLabel(requestedLanguage);
  if (!p || !r) return false;

  // Treat "Chinese (Mandarin)" as the canonical label for matching.
  if (p === 'chinese (mandarin)' && r === 'chinese (mandarin)') return true;

  return p === r;
}

