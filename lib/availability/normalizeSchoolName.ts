export function normalizeSchoolName(input: unknown): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

