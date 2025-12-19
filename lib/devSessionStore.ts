import { Session } from '@/lib/models/types';

const STORAGE_KEY = 'ivyway_dev_sessions_v1';

function safeParse(json: string | null): Session[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed as Session[];
  } catch {
    return [];
  }
}

export function getDevSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function setDevSessions(sessions: Session[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function addDevSession(session: Session) {
  const sessions = getDevSessions();
  sessions.push(session);
  setDevSessions(sessions);
}

export function upsertDevSession(session: Session) {
  const sessions = getDevSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  setDevSessions(sessions);
}

export function updateDevSession(id: string, patch: Partial<Session>) {
  const sessions = getDevSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx < 0) return;
  sessions[idx] = { ...sessions[idx], ...patch };
  setDevSessions(sessions);
}


export function getDevPaidSessionsByStudentId(studentId: string): Session[] {
  const sessions = getDevSessions();
  // Include both 'scheduled' (automatically confirmed at booking) and 'paid' (legacy) statuses
  return sessions.filter(
    s => s.studentId === studentId && (s.status === 'paid' || s.status === 'scheduled')
  );
}

export function getDevPaidSessionsByProviderId(providerId: string): Session[] {
  const sessions = getDevSessions();
  // Include both 'scheduled' (automatically confirmed at booking) and 'paid' (legacy) statuses
  return sessions.filter(
    s => s.providerId === providerId && (s.status === 'paid' || s.status === 'scheduled')
  );
}

/**
 * Get upcoming sessions for a student (scheduled sessions in the future)
 */
export function getDevUpcomingSessionsByStudentId(studentId: string): Session[] {
  const sessions = getDevSessions();
  const now = new Date();
  return sessions.filter(
    s => s.studentId === studentId 
      && (s.status === 'paid' || s.status === 'scheduled')
      && new Date(s.scheduledStartTime) > now
  );
}

/**
 * Get completed sessions for a student (completed or past scheduled sessions)
 */
export function getDevCompletedSessionsByStudentId(studentId: string): Session[] {
  const sessions = getDevSessions();
  const now = new Date();
  return sessions.filter(
    s => s.studentId === studentId 
      && (s.status === 'completed' || (s.status === 'scheduled' && new Date(s.scheduledStartTime) <= now))
  );
}

/**
 * Get upcoming sessions for a provider (scheduled sessions in the future)
 */
export function getDevUpcomingSessionsByProviderId(providerId: string): Session[] {
  const sessions = getDevSessions();
  const now = new Date();
  return sessions.filter(
    s => s.providerId === providerId 
      && (s.status === 'paid' || s.status === 'scheduled')
      && new Date(s.scheduledStartTime) > now
  );
}

/**
 * Get past sessions for a provider (completed or past scheduled sessions)
 */
export function getDevPastSessionsByProviderId(providerId: string): Session[] {
  const sessions = getDevSessions();
  const now = new Date();
  return sessions.filter(
    s => s.providerId === providerId 
      && (s.status === 'completed' || (s.status === 'scheduled' && new Date(s.scheduledStartTime) <= now))
  );
}

export function removeDevSessionsByProviderIdAndStatus(
  providerId: string,
  status: Session['status']
) {
  const sessions = getDevSessions();
  const filtered = sessions.filter(
    s => !(s.providerId === providerId && s.status === status)
  );
  setDevSessions(filtered);
}

export function clearDevSessions() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function seedDevSessionsIfEmpty(seed: Session[]) {
  const existing = getDevSessions();
  if (existing.length > 0) return;
  setDevSessions(seed);
}

/**
 * Seed dev data for a provider
 * Reads ivyway_dev_sessions_v1 from localStorage
 * If missing or empty, writes at least 5 available sessions
 */
export function seedDevDataForProvider(providerUserId: string): void {
  if (typeof window === 'undefined') return;
  
  const existing = getDevSessions();
  // Only seed if storage is missing or empty
  if (existing.length > 0) return;
  
  const now = new Date();
  const sessions: Session[] = [];
  
  // Create at least 5 available sessions with different dates/times
  // Mix of tutoring and counseling session types
  const sessionTypes: ('tutoring' | 'counseling')[] = ['tutoring', 'counseling', 'tutoring', 'counseling', 'tutoring'];
  
  // Generate unique IDs using crypto.randomUUID if available, otherwise use timestamp-based IDs
  const generateId = (index: number): string => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `session-${providerUserId}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
  };
  
  for (let i = 0; i < 5; i++) {
    const sessionDate = new Date(now);
    sessionDate.setDate(now.getDate() + i + 1); // Start from tomorrow, increment each day
    sessionDate.setHours(10 + i, 0, 0, 0); // Different hours: 10, 11, 12, 13, 14
    
    const startTime = new Date(sessionDate);
    const endTime = new Date(sessionDate);
    endTime.setHours(endTime.getHours() + 1); // 1 hour sessions
    
    const session: Session = {
      id: generateId(i),
      studentId: '', // Empty for available sessions
      providerId: providerUserId, // Set to provider's auth.user.id
      serviceTypeId: sessionTypes[i] === 'tutoring' ? 'tutoring' : 'counseling',
      sessionType: sessionTypes[i],
      scheduledStartTime: startTime.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      status: 'available',
      priceCents: sessionTypes[i] === 'tutoring' ? 6900 : 8900,
      amountChargedCents: 0,
      amountRefundedCents: 0,
      bookedAt: '',
      bookedBy: '',
      availabilityId: `availability-${providerUserId}-${Date.now()}-${i}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    
    sessions.push(session);
  }
  
  setDevSessions(sessions);
}

