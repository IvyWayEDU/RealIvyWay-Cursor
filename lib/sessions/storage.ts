import { Session } from '@/lib/models/types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Read sessions from file
export async function getSessions(): Promise<Session[]> {
  await ensureDataDir();
  
  if (!existsSync(SESSIONS_FILE)) {
    return [];
  }
  
  try {
    const data = await readFile(SESSIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sessions file:', error);
    return [];
  }
}

// Write sessions to file
export async function saveSessions(sessions: Session[]): Promise<void> {
  await ensureDataDir();
  await writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

// Find sessions by student ID
export async function getSessionsByStudentId(studentId: string): Promise<Session[]> {
  const sessions = await getSessions();
  return sessions.filter(session => session.studentId === studentId);
}

// Find sessions by provider ID
export async function getSessionsByProviderId(providerId: string): Promise<Session[]> {
  const sessions = await getSessions();
  return sessions.filter(session => session.providerId === providerId);
}

// Add new session
export async function createSession(session: Session): Promise<void> {
  const sessions = await getSessions();
  sessions.push(session);
  await saveSessions(sessions);
}

// Get session by ID
export async function getSessionById(id: string): Promise<Session | null> {
  const sessions = await getSessions();
  return sessions.find(session => session.id === id) || null;
}

// Update session by ID
export async function updateSession(id: string, patch: Partial<Session>): Promise<boolean> {
  const sessions = await getSessions();
  const index = sessions.findIndex(session => session.id === id);
  if (index === -1) {
    return false;
  }
  sessions[index] = { ...sessions[index], ...patch, updatedAt: new Date().toISOString() };
  await saveSessions(sessions);
  return true;
}

