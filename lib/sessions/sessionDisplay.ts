import { normalizeProviderId } from '@/lib/sessions/providerDisplay';

export type CanonicalServiceType =
  | 'tutoring'
  | 'college_counseling'
  | 'test_prep'
  | 'virtual_tour'
  | string;

function normalizeServiceType(raw: unknown): CanonicalServiceType | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;

  // Accept some legacy spellings but keep everything read-time only.
  if (v === 'counseling') return 'college_counseling';
  if (v === 'test-prep') return 'test_prep';
  if (v === 'virtual-tour') return 'virtual_tour';
  return v;
}

export function getCanonicalServiceType(session: unknown): CanonicalServiceType | null {
  // Requirement: Always render from session.serviceType (no session.sessionType fallback).
  return normalizeServiceType((session as any)?.serviceType);
}

export function formatServiceTypeLabel(serviceType: CanonicalServiceType | null): string {
  if (!serviceType) return 'Service';
  switch (serviceType) {
    case 'tutoring':
      return 'Tutoring';
    case 'college_counseling':
      return 'College Counseling';
    case 'test_prep':
      return 'Test Prep';
    case 'virtual_tour':
      return 'Virtual Tour';
    default: {
      // Fallback: Title Case underscores/dashes.
      const cleaned = String(serviceType).replace(/[_-]+/g, ' ').trim();
      if (!cleaned) return 'Service';
      return cleaned
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
}

function resolveSchoolLabel(raw: unknown): string | null {
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

export function getCanonicalTopicLabel(session: unknown): string | null {
  const type = getCanonicalServiceType(session);
  if (!type) return null;
  if (type === 'tutoring' || type === 'test_prep') {
    const subjectRaw = (session as any)?.subject;
    const topicRaw = (session as any)?.topic;
    const subject = typeof subjectRaw === 'string' && subjectRaw.trim() ? subjectRaw.trim() : null;
    const topic = typeof topicRaw === 'string' && topicRaw.trim() ? topicRaw.trim() : null;
    if (!subject) return null;
    // UX: show topic next to subject everywhere after booking.
    // Example: "Math — Quadratic Equations"
    return topic ? `${subject} — ${topic}` : subject;
  }
  if (type === 'college_counseling') {
    return resolveSchoolLabel((session as any)?.school);
  }
  return null;
}

export function getCanonicalProviderId(session: unknown): string | null {
  return normalizeProviderId((session as any)?.providerId);
}



