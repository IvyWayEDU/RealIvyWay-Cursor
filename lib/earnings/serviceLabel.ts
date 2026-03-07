/**
 * Canonical earnings label mapping from session.serviceType.
 *
 * IMPORTANT:
 * - virtual_tour MUST NOT fall back to college counseling.
 */
export function getEarningsServiceLabel(serviceType: unknown): string {
  const v = typeof serviceType === 'string' ? serviceType.trim().toLowerCase().replace(/-/g, '_') : '';
  switch (v) {
    case 'virtual_tour':
      return 'Virtual Tour';
    case 'college_counseling':
      return 'College Counseling';
    case 'tutoring':
      return 'Tutoring';
    case 'test_prep':
      return 'Test Prep Session Earnings';
    default:
      return 'Service';
  }
}


