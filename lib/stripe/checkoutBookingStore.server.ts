import 'server-only';

import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

type StoredSessionTime = { scheduledStart: string; scheduledEnd: string };

export type CheckoutBookingRecord = {
  id: string;
  createdAt: string;
  studentId: string;
  providerId: string;
  serviceType: string;
  plan: 'single' | 'monthly' | 'yearly';
  sessionTimes: StoredSessionTime[];
  // Booking context (stored server-side; Stripe metadata is size-limited)
  subject?: string | null;
  topic?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
};

type CheckoutBookingStorage = Record<string, CheckoutBookingRecord>;

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'checkout-bookings.json');

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readAll(): Promise<CheckoutBookingStorage> {
  await ensureDataDir();
  if (!existsSync(FILE_PATH)) return {};
  try {
    const raw = await readFile(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as CheckoutBookingStorage;
  } catch {
    return {};
  }
}

async function writeAll(next: CheckoutBookingStorage): Promise<void> {
  await ensureDataDir();
  const tmp = `${FILE_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), 'utf-8');
  await rename(tmp, FILE_PATH);
}

function toIsoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export async function writeCheckoutBookingRecord(record: CheckoutBookingRecord): Promise<void> {
  if (!record?.id) throw new Error('Missing checkout booking id');
  const all = await readAll();
  all[record.id] = record;
  await writeAll(all);
}

export async function readCheckoutBookingRecord(id: string): Promise<CheckoutBookingRecord | null> {
  if (!id) return null;
  const all = await readAll();
  const found = all[id];
  if (!found) return null;
  // Normalize defensively
  const sessionTimes: StoredSessionTime[] = Array.isArray(found.sessionTimes)
    ? found.sessionTimes
        .map((t: any) => {
          const s = toIsoOrNull(t?.scheduledStart);
          const e = toIsoOrNull(t?.scheduledEnd);
          if (!s || !e) return null;
          const sMs = new Date(s).getTime();
          const eMs = new Date(e).getTime();
          if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) return null;
          return { scheduledStart: s, scheduledEnd: e };
        })
        .filter((t): t is StoredSessionTime => Boolean(t))
    : [];
  return {
    id: String(found.id),
    createdAt: typeof found.createdAt === 'string' ? found.createdAt : new Date().toISOString(),
    studentId: typeof found.studentId === 'string' ? found.studentId : '',
    providerId: typeof found.providerId === 'string' ? found.providerId : '',
    serviceType: typeof found.serviceType === 'string' ? found.serviceType : '',
    plan: found.plan === 'monthly' || found.plan === 'yearly' ? found.plan : 'single',
    sessionTimes,
    subject: typeof (found as any)?.subject === 'string' && String((found as any).subject).trim() ? String((found as any).subject).trim() : null,
    topic: typeof (found as any)?.topic === 'string' && String((found as any).topic).trim() ? String((found as any).topic).trim() : null,
    schoolId:
      typeof (found as any)?.schoolId === 'string' && String((found as any).schoolId).trim()
        ? String((found as any).schoolId).trim()
        : null,
    schoolName:
      typeof (found as any)?.schoolName === 'string' && String((found as any).schoolName).trim()
        ? String((found as any).schoolName).trim()
        : null,
  };
}

export async function deleteCheckoutBookingRecord(id: string): Promise<void> {
  if (!id) return;
  const all = await readAll();
  if (!all[id]) return;
  delete all[id];
  await writeAll(all);
}


