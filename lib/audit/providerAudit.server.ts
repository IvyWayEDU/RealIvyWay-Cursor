import 'server-only';

import path from 'path';

export type ProviderAuditSource = 'provider_test_override';

export type ProviderAuditEntry = {
  providerId: string; // provider userId (matches session.providerId)
  sessionId: string;
  timestamp: string; // ISO
  source: ProviderAuditSource;
};

const AUDIT_FILE = path.join(process.cwd(), 'data', 'provider-audit.jsonl');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

/**
 * Append-only audit log (JSON Lines) for provider actions.
 * Stored locally under /data for this codebase's JSON-backed storage model.
 */
export async function appendProviderAuditEntry(entry: ProviderAuditEntry): Promise<void> {
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



