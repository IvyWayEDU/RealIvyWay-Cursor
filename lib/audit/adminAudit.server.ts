import 'server-only';

import path from 'path';

export type AdminAuditAction =
  | 'FORCE_COMPLETE_SESSION_TEST'
  | 'FORCE_COMPLETE_SESSION'
  | 'CANCEL_SESSION'
  | 'FLAG_SESSION'
  | 'SET_PAYOUT_STATUS';

export type AdminAuditEntry = {
  action: AdminAuditAction;
  adminUserId: string;
  sessionId: string;
  timestamp: string; // ISO
};

const AUDIT_FILE = path.join(process.cwd(), 'data', 'admin-audit.jsonl');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

/**
 * Append-only audit log (JSON Lines) for admin actions.
 * Stored locally under /data for this codebase's JSON-backed storage model.
 */
export async function appendAdminAuditEntry(entry: AdminAuditEntry): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dir = path.dirname(AUDIT_FILE);
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dir, { recursive: true });
    await fsp.appendFile(AUDIT_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch {
    return;
  }
}



