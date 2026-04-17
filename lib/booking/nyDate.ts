export function getNYDateKey(input: string | Date) {
  // If the caller already has a canonical date key, preserve it.
  // Parsing "YYYY-MM-DD" with `new Date(...)` treats it as UTC midnight, which can shift the
  // day in America/New_York and cause missing availability (e.g., Monday -> Sunday).
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(input));
}

