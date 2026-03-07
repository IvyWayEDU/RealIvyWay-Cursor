'use client';

interface SessionDebugPanelProps {
  userRole: 'student' | 'provider';
}

/**
 * Temporary Debug Panel
 * 
 * Shows raw session objects being stored for debugging purposes.
 * Only visible in development mode.
 * 
 * Displays:
 * - id
 * - studentId
 * - providerId
 * - status
 * - date (from scheduledStartTime)
 * - time (from scheduledStartTime)
 * - sessionType
 */
export default function SessionDebugPanel({ userRole }: SessionDebugPanelProps) {
  void userRole;
  // Dev session helpers have been removed. This panel is intentionally disabled.
  return null;
}


