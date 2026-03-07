import { SCHOOLS } from '@/data/schools';
import { getCanonicalServiceType } from '@/lib/sessions/sessionDisplay';

function normalizeToCanonicalService(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  const lowered = v.toLowerCase().replace(/-/g, '_');
  switch (lowered) {
    case 'tutoring':
      return 'tutoring';
    case 'test_prep':
      return 'test_prep';
    case 'college_counseling':
    case 'counseling':
    case 'college-counseling':
      return 'college_counseling';
    case 'virtual_tour':
    case 'virtual-tour':
      return 'virtual_tour';
    default:
      return lowered;
  }
}

function resolveSchoolName(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const v = raw.trim();
    return v ? v : null;
  }
  if (typeof raw === 'object') {
    const v =
      (raw as any)?.displayName ??
      (raw as any)?.name ??
      (raw as any)?.schoolName ??
      (raw as any)?.label ??
      null;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  return null;
}

function resolveSchoolIdFromName(name: string | null): string | null {
  if (!name) return null;
  const match = SCHOOLS.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return match?.id ?? null;
}

/**
 * Build a contextual rebooking URL for /dashboard/book.
 *
 * Query params used:
 * - service (required to trigger skip/prefill)
 * - subject (tutoring/test_prep)
 * - topic (optional; tutoring only)
 * - schoolId + schoolName (college_counseling/virtual_tour)
 * - providerId (optional)
 */
export function buildRebookUrlFromSession(session: unknown): string {
  const params = new URLSearchParams();

  const providerId = typeof (session as any)?.providerId === 'string' ? String((session as any).providerId) : '';
  if (providerId) params.set('providerId', providerId);

  // Prefer canonical booking-flow serviceType, fallback to legacy fields.
  const canonicalFromDisplay = getCanonicalServiceType(session);
  const canonical =
    normalizeToCanonicalService(canonicalFromDisplay) ||
    normalizeToCanonicalService((session as any)?.serviceType) ||
    normalizeToCanonicalService((session as any)?.service_type) ||
    normalizeToCanonicalService((session as any)?.sessionType);

  if (canonical) params.set('service', canonical);

  if (canonical === 'tutoring' || canonical === 'test_prep') {
    const subject =
      typeof (session as any)?.subject === 'string' && String((session as any).subject).trim()
        ? String((session as any).subject).trim()
        : null;
    if (subject) params.set('subject', subject);

    // Optional: tutoring topic, if available on the session record.
    const topic =
      typeof (session as any)?.topic === 'string' && String((session as any).topic).trim()
        ? String((session as any).topic).trim()
        : null;
    if (canonical === 'tutoring' && topic) params.set('topic', topic);
  }

  if (canonical === 'college_counseling' || canonical === 'virtual_tour') {
    const schoolIdRaw =
      (typeof (session as any)?.schoolId === 'string' && String((session as any).schoolId).trim()) ||
      (typeof (session as any)?.school_id === 'string' && String((session as any).school_id).trim()) ||
      (typeof (session as any)?.school?.id === 'string' && String((session as any).school.id).trim()) ||
      '';
    const schoolNameRaw =
      (typeof (session as any)?.schoolName === 'string' && String((session as any).schoolName).trim()) ||
      (typeof (session as any)?.school_name === 'string' && String((session as any).school_name).trim()) ||
      resolveSchoolName((session as any)?.school) ||
      '';

    const schoolName = schoolNameRaw || null;
    const schoolId = schoolIdRaw || resolveSchoolIdFromName(schoolName) || null;

    if (schoolId) params.set('schoolId', schoolId);
    if (schoolName) params.set('schoolName', schoolName);
  }

  const qs = params.toString();
  return qs ? `/dashboard/book?${qs}` : '/dashboard/book';
}



