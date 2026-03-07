/**
 * TEMPORARY BACKFILL SCRIPT (delete after running)
 *
 * Fixes legacy sessions where `providerEarned` / `providerEligibleForPayout` were incorrectly
 * persisted as `false` by old normalization logic.
 *
 * What it does:
 * - For sessions with status === "completed"
 * - If providerEarned/providerEligibleForPayout are false BUT the session is NOT marked as a no-show,
 *   it flips them to true (and clears no-show markers).
 *
 * Safety:
 * - Default mode is DRY RUN (prints what it would change)
 * - Pass `--apply` to actually write to `data/sessions.json`
 *
 * Run:
 *   npm -C ivyway-web run -s pricing:validate   # (optional sanity check that scripts build)
 *   cd ivyway-web
 *   npx -y tsc -p tsconfig.scripts.json
 *   node .scripts-build/scripts/temp-backfill-provider-earned.js --apply
 */

import { promises as fs } from 'fs';
import path from 'path';

type AnySession = Record<string, any>;

function isNoShowMarked(s: AnySession): boolean {
  const status = String(s?.status || '').trim();
  if (status === 'completed_no_show_provider') return true;
  const noShowParty = String(s?.noShowParty || '').trim().toLowerCase();
  if (noShowParty === 'provider' || noShowParty === 'both') return true;
  const attendanceFlag = String(s?.attendanceFlag || '').trim().toLowerCase();
  if (attendanceFlag === 'provider_no_show' || attendanceFlag === 'full_no_show') return true;
  if (s?.flagNoShowProvider === true) return true;
  return false;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const file = path.join(process.cwd(), 'data', 'sessions.json');

  const raw = await fs.readFile(file, 'utf-8');
  const parsed = JSON.parse(raw);
  const sessions: AnySession[] = Array.isArray(parsed) ? parsed : [];

  const nowISO = new Date().toISOString();
  let candidates = 0;
  let changed = 0;

  for (const s of sessions) {
    if (String(s?.status || '') !== 'completed') continue;
    if (isNoShowMarked(s)) continue;

    // Only touch sessions that are explicitly marked as not earned/eligible.
    const providerEarned = s?.providerEarned;
    const eligible = s?.providerEligibleForPayout;
    const explicitlyWithheld = providerEarned === false || eligible === false;
    if (!explicitlyWithheld) continue;

    candidates += 1;

    if (!apply) continue;

    s.providerEarned = true;
    s.providerEligibleForPayout = true;
    s.flagNoShowProvider = false;
    s.attendanceFlag = 'none';
    s.noShowParty = s.noShowParty === 'provider' || s.noShowParty === 'both' ? null : s.noShowParty;
    s.updatedAt = nowISO;
    changed += 1;
  }

  console.log('[temp-backfill-provider-earned]', {
    file,
    mode: apply ? 'APPLY' : 'DRY_RUN',
    candidates,
    changed,
  });

  if (apply) {
    await fs.writeFile(file, JSON.stringify(sessions, null, 2), 'utf-8');
    console.log('[temp-backfill-provider-earned] wrote sessions.json');
  } else {
    console.log('[temp-backfill-provider-earned] no changes written (pass --apply)');
  }
}

main().catch((e) => {
  console.error('[temp-backfill-provider-earned] failed', e);
  process.exit(1);
});


