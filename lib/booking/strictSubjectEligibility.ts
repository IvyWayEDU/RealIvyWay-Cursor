import { normalizeSubjectId } from '@/lib/models/subjects';

function normalizeRawSubjectLabel(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[_/.-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBookingSubjectId(input: unknown): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const canonical = normalizeSubjectId(raw);
  if (canonical) return canonical;

  const normalized = normalizeRawSubjectLabel(raw);
  if (!normalized) return null;

  const strictMap: Record<string, string> = {
    math: 'math',
    mathematics: 'math',
    english: 'english',
    'english and language arts': 'english',
    'language arts': 'english',
    languages: 'languages',
    'foreign languages': 'languages',
    'foreign language': 'languages',
    'computer science': 'computer_science',
    'test prep': 'test_prep',
    testprep: 'test_prep',
    'test preparation': 'test_prep',
  };

  return strictMap[normalized] ?? null;
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v ?? '').trim()).filter(Boolean);
}

export function getProviderSubjectIdsFromProfileJson(params: { providerData: unknown; userData: unknown }): string[] {
  const providerData = params.providerData && typeof params.providerData === 'object' ? (params.providerData as any) : {};

  // SINGLE SOURCE OF TRUTH:
  // Subjects must come ONLY from providers.data.subjects (no merging, no fallbacks).
  const rawSubjects = normalizeStringArray(providerData?.subjects);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of rawSubjects) {
    const canonical = normalizeBookingSubjectId(s);
    if (!canonical) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

