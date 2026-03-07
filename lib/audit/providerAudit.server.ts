import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';

export type ProviderAuditSource = 'provider_test_override';

export type ProviderAuditEntry = {
  providerId: string; // provider userId (matches session.providerId)
  sessionId: string;
  timestamp: string; // ISO
  source: ProviderAuditSource;
};

const AUDIT_FILE = path.join(process.cwd(), 'data', 'provider-audit.jsonl');

/**
 * Append-only audit log (JSON Lines) for provider actions.
 * Stored locally under /data for this codebase's JSON-backed storage model.
 */
export async function appendProviderAuditEntry(entry: ProviderAuditEntry): Promise<void> {
  const dir = path.dirname(AUDIT_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(AUDIT_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
}



