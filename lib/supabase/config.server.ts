import 'server-only';

type SupabaseEnvPair = {
  url: string;
  serviceRoleKey: string;
  ref: string;
};

let _main: SupabaseEnvPair | null = null;
let _ai: SupabaseEnvPair | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (name === 'SUPABASE_URL') {
    console.log('[ivyway-web][env] requireEnv(SUPABASE_URL)', {
      cwd: process.cwd(),
      value: v,
      serviceRoleKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      aiUrlSet: Boolean(process.env.SUPABASE_AI_URL),
      aiServiceRoleKeySet: Boolean(process.env.SUPABASE_AI_SERVICE_ROLE_KEY),
    });
  }
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function readEnv(name: string): string | null {
  const v = process.env[name];
  return v ? String(v) : null;
}

function base64UrlToUtf8(input: string): string {
  // base64url => base64
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64').toString('utf8');
}

function extractRefFromJwt(jwt: string): string | null {
  const parts = String(jwt || '').split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = base64UrlToUtf8(parts[1] || '');
    const payload = JSON.parse(payloadJson) as { ref?: unknown };
    return typeof payload?.ref === 'string' && payload.ref.trim() ? payload.ref.trim() : null;
  } catch {
    return null;
  }
}

function extractSupabaseRefFromUrl(url: string): string {
  const u = new URL(url);
  const host = u.hostname || '';
  if (!host.endsWith('.supabase.co')) {
    throw new Error(`Supabase URL must end with ".supabase.co" (got host=${host})`);
  }
  const ref = host.split('.')[0] || '';
  if (!ref) throw new Error('Could not infer Supabase project ref from URL');
  return ref;
}

function assertNoMainAiConflict(mainRef: string, aiRef: string): void {
  if (mainRef === aiRef) {
    throw new Error(
      `Supabase configuration conflict: main and AI are pointing at the same project ref (${mainRef}). ` +
        'Main IvyWay app must use IvyWayEDU DB, and AI must use the AI DB.'
    );
  }
}

function buildPair(urlEnv: string, keyEnv: string, opts: { allowFunctionsPath: boolean }): SupabaseEnvPair {
  const url = requireEnv(urlEnv);
  const serviceRoleKey = requireEnv(keyEnv);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL in env var ${urlEnv}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${urlEnv} must be an https URL`);
  }

  if (!opts.allowFunctionsPath) {
    if (parsed.pathname.includes('/functions/')) {
      throw new Error(
        `${urlEnv} looks like a Supabase Functions endpoint (pathname=${parsed.pathname}). ` +
          `Main app must use the project URL like "https://<ref>.supabase.co".`
      );
    }
    if (parsed.pathname !== '' && parsed.pathname !== '/') {
      throw new Error(`${urlEnv} must not include a path (got pathname=${parsed.pathname})`);
    }
  }

  const refFromUrl = extractSupabaseRefFromUrl(url);
  const refFromJwt = extractRefFromJwt(serviceRoleKey);
  if (refFromJwt && refFromJwt !== refFromUrl) {
    throw new Error(
      `Supabase key mismatch: ${keyEnv} is for ref=${refFromJwt} but ${urlEnv} is for ref=${refFromUrl}.`
    );
  }

  return { url, serviceRoleKey, ref: refFromUrl };
}

/**
 * Main IvyWay app Supabase (IvyWayEDU DB).
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
export function getMainSupabaseEnv(): Pick<SupabaseEnvPair, 'url' | 'serviceRoleKey'> {
  if (!_main) {
    _main = buildPair('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', { allowFunctionsPath: false });
  }

  // If AI is also configured, enforce distinct projects.
  const aiUrl = readEnv('SUPABASE_AI_URL');
  const aiKey = readEnv('SUPABASE_AI_SERVICE_ROLE_KEY');
  if (aiUrl && aiKey) {
    if (!_ai) _ai = buildPair('SUPABASE_AI_URL', 'SUPABASE_AI_SERVICE_ROLE_KEY', { allowFunctionsPath: true });
    assertNoMainAiConflict(_main.ref, _ai.ref);
  }

  return { url: _main.url, serviceRoleKey: _main.serviceRoleKey };
}

/**
 * AI system Supabase access (AI DB / AI edge function).
 * Required env vars:
 * - SUPABASE_AI_URL
 * - SUPABASE_AI_SERVICE_ROLE_KEY
 */
export function getAiSupabaseEnv(): Pick<SupabaseEnvPair, 'url' | 'serviceRoleKey'> {
  if (!_ai) {
    _ai = buildPair('SUPABASE_AI_URL', 'SUPABASE_AI_SERVICE_ROLE_KEY', { allowFunctionsPath: true });
  }

  // If main is also configured, enforce distinct projects.
  const mainUrl = readEnv('SUPABASE_URL');
  const mainKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (mainUrl && mainKey) {
    if (!_main) _main = buildPair('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', { allowFunctionsPath: false });
    assertNoMainAiConflict(_main.ref, _ai.ref);
  }

  return { url: _ai.url, serviceRoleKey: _ai.serviceRoleKey };
}

