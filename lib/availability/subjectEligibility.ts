function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v ?? '').trim()).filter(Boolean);
}

// REQUIRED: Canonical subject normalization helper (shared everywhere).
export const normalizeSubject = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

export type TestPrepNormalizedMatchLog = {
  selectedSubjectRaw: unknown;
  selectedSubjectNormalized: string;
  providerId: string;
  providerSubjectsRaw: unknown;
  providerSubjectsNormalized: string[];
  matched: boolean;
};

/**
 * Subject eligibility matcher used by Availability + Confirm Provider APIs.
 *
 * Rules:
 * - Always compare normalized strings (never raw).
 * - Test Prep is strict:
 *   - selectedSubjectNormalized === 'test_prep' =>
 *     provider is eligible ONLY if services includes 'tutoring' AND providerSubjectsNormalized includes 'test_prep'
 * - Normal tutoring subjects remain unchanged: subject must be explicitly present on provider.
 */
export function computeSubjectEligibility(params: {
  selectedSubjectRaw: unknown;
  providerId: unknown;
  providerSubjectsRaw: unknown;
  providerServicesRaw: unknown;
}): {
  selectedSubjectNormalized: string;
  providerSubjectsNormalized: string[];
  matched: boolean;
  log: TestPrepNormalizedMatchLog;
} {
  const selectedSubjectNormalized = normalizeSubject(params.selectedSubjectRaw);

  const providerId = String(params.providerId ?? '').trim();
  const providerSubjectsRaw = params.providerSubjectsRaw;
  const providerSubjectsNormalized = normalizeStringArray(providerSubjectsRaw).map(normalizeSubject).filter(Boolean);

  const providerServices = normalizeStringArray(params.providerServicesRaw).map((s) => String(s).trim());
  const hasTutoringService = providerServices.includes('tutoring');

  let matched = false;
  if (!selectedSubjectNormalized) {
    matched = false;
  } else if (selectedSubjectNormalized === 'test_prep') {
    matched = hasTutoringService && providerSubjectsNormalized.includes('test_prep');
  } else {
    matched = providerSubjectsNormalized.includes(selectedSubjectNormalized);
  }

  return {
    selectedSubjectNormalized,
    providerSubjectsNormalized,
    matched,
    log: {
      selectedSubjectRaw: params.selectedSubjectRaw,
      selectedSubjectNormalized,
      providerId,
      providerSubjectsRaw,
      providerSubjectsNormalized,
      matched,
    },
  };
}

