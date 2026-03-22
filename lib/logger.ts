type LogScope = string;

function parseDebugScopes(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const v = part.trim().toLowerCase();
    if (v) out.add(v);
  }
  return out;
}

function readDebugEnv(): string | undefined {
  // Server: IVYWAY_DEBUG="*" or "availability,heartbeat"
  // Client: NEXT_PUBLIC_IVYWAY_DEBUG="*" or "availability,heartbeat"
  const server = process.env.IVYWAY_DEBUG;
  const client = process.env.NEXT_PUBLIC_IVYWAY_DEBUG;
  return server || client;
}

const DEBUG_SCOPES = parseDebugScopes(readDebugEnv());

function isDebugEnabled(scope?: LogScope): boolean {
  if (DEBUG_SCOPES.size === 0) return false;
  if (DEBUG_SCOPES.has('*')) return true;
  if (!scope) return false;
  return DEBUG_SCOPES.has(scope.toLowerCase());
}

export const logger = {
  debug(scope: LogScope, message: string, meta?: unknown) {
    if (!isDebugEnabled(scope)) return;
    if (meta === undefined) {
      console.debug(`[${scope}] ${message}`);
      return;
    }
    console.debug(`[${scope}] ${message}`, meta);
  },
  error(scope: LogScope, message: string, meta?: unknown) {
    if (meta === undefined) {
      console.error(`[${scope}] ${message}`);
      return;
    }
    console.error(`[${scope}] ${message}`, meta);
  },
};

