import 'server-only';

import path from 'path';
import crypto from 'crypto';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

export type AdminAuditAction =
  | 'FORCE_COMPLETE_SESSION_TEST'
  | 'FORCE_COMPLETE_SESSION'
  | 'CANCEL_SESSION'
  | 'FLAG_SESSION'
  | 'SET_PAYOUT_STATUS'
  | 'UPDATE_SESSION_NOTES'
  // Forward-compatible: allow new actions without a type migration.
  | (string & {});

export type AdminAuditEntry = {
  action: AdminAuditAction;
  adminUserId: string;
  sessionId: string;
  timestamp: string; // ISO
  metadata?: Record<string, unknown> | null;
};

const AUDIT_FILE = path.join(process.cwd(), 'data', 'admin-audit.jsonl');

function hasSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function newId(prefix: string): string {
  const uuid = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

/**
 * Append-only audit log (JSON Lines) for admin actions.
 * Stored locally under /data for this codebase's JSON-backed storage model.
 */
export async function appendAdminAuditEntry(entry: AdminAuditEntry): Promise<void> {
  // Primary: Supabase (production-safe).
  if (hasSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('admin_action_log').insert({
        id: newId('adminlog'),
        admin_user_id: String(entry.adminUserId || '').trim(),
        action: String(entry.action || '').trim(),
        entity_type: 'session',
        entity_id: String(entry.sessionId || '').trim(),
        metadata: entry.metadata ?? null,
        created_at: String(entry.timestamp || new Date().toISOString()),
      } as any);
      return;
    } catch {
      // fall through to FS fallback
    }
  }

  const dir = path.dirname(AUDIT_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dir, { recursive: true });
    await fsp.appendFile(AUDIT_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch {
    return;
  }
}



