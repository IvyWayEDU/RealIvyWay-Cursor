import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type AuditLogAction =
  | 'session_booked'
  | 'session_cancelled'
  | 'session_completed'
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_paid'
  | 'support_ticket_created'
  | 'support_reply_sent'
  | 'provider_profile_updated'
  | 'admin_payout_approved'
  | (string & {});

export type AuditLogRow = {
  id: string;
  userId: string;
  userRole: string;
  action: AuditLogAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
};

const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit-logs.jsonl');

function newId(): string {
  const uuid = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `audit_${uuid}`;
}

function toIsoOrNow(v: unknown): string {
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

async function ensureDir(): Promise<void> {
  const dir = path.dirname(AUDIT_FILE);
  await fs.mkdir(dir, { recursive: true });
}

export async function logAuditEvent(input: {
  userId: string;
  userRole: string;
  action: AuditLogAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  id?: string;
}): Promise<AuditLogRow> {
  const row: AuditLogRow = {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : newId(),
    userId: String(input.userId || '').trim(),
    userRole: String(input.userRole || '').trim() || 'unknown',
    action: input.action,
    entityType: String(input.entityType || '').trim() || 'unknown',
    entityId: String(input.entityId || '').trim(),
    metadata: input.metadata ?? null,
    createdAt: toIsoOrNow(input.createdAt),
  };

  // Avoid writing obviously invalid rows.
  if (!row.userId || !row.action || !row.entityId) {
    return row;
  }

  await ensureDir();
  await fs.appendFile(AUDIT_FILE, `${JSON.stringify(row)}\n`, 'utf-8');
  return row;
}

function parseDateBound(input: string, bound: 'start' | 'end'): number | null {
  const s = String(input || '').trim();
  if (!s) return null;

  // Accept YYYY-MM-DD as a local-agnostic day bound (use UTC to avoid timezone drift in logs).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const iso = bound === 'start' ? `${s}T00:00:00.000Z` : `${s}T23:59:59.999Z`;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export async function listAuditLogs(args: {
  userIds?: string[];
  action?: string;
  from?: string; // ISO or YYYY-MM-DD
  to?: string; // ISO or YYYY-MM-DD
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogRow[]; totalScanned: number }> {
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(args.limit ?? 200))));
  const offset = Math.max(0, Math.floor(Number(args.offset ?? 0)));
  const action = typeof args.action === 'string' && args.action.trim() ? args.action.trim() : null;
  const userIdSet =
    Array.isArray(args.userIds) && args.userIds.length > 0
      ? new Set(args.userIds.map((s) => String(s || '').trim()).filter(Boolean))
      : null;

  const fromMs = typeof args.from === 'string' ? parseDateBound(args.from, 'start') : null;
  const toMs = typeof args.to === 'string' ? parseDateBound(args.to, 'end') : null;

  let raw = '';
  try {
    raw = await fs.readFile(AUDIT_FILE, 'utf-8');
  } catch (e: any) {
    if (e?.code === 'ENOENT') return { logs: [], totalScanned: 0 };
    throw e;
  }

  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const out: AuditLogRow[] = [];
  let matched = 0;
  let totalScanned = 0;

  // Newest-first scan (append-only file).
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    totalScanned++;
    let row: AuditLogRow | null = null;
    try {
      row = JSON.parse(line) as AuditLogRow;
    } catch {
      continue;
    }

    if (!row || typeof row !== 'object') continue;
    if (userIdSet && !userIdSet.has(String((row as any).userId || '').trim())) continue;
    if (action && String((row as any).action || '').trim() !== action) continue;

    const createdAt = String((row as any).createdAt || '').trim();
    const createdMs = createdAt ? Date.parse(createdAt) : NaN;
    if (fromMs !== null && Number.isFinite(createdMs) && createdMs < fromMs) continue;
    if (toMs !== null && Number.isFinite(createdMs) && createdMs > toMs) continue;

    if (matched >= offset) {
      out.push(row);
      if (out.length >= limit) break;
    }
    matched++;
  }

  return { logs: out, totalScanned };
}

