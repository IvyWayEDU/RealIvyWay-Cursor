import 'server-only';

import crypto from 'crypto';

function base64UrlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getEmbedSecret(): string {
  const secret = process.env.IVYWAY_AI_EMBED_TOKEN_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV !== 'production') {
    // Local/dev fallback only (production MUST set IVYWAY_AI_EMBED_TOKEN_SECRET)
    return 'ivyway-dev-embed-secret-change-me';
  }

  throw new Error(
    'Missing IVYWAY_AI_EMBED_TOKEN_SECRET. Set it in your environment to generate IvyWay AI embed tokens.'
  );
}

export function createIvyWayAiEmbedToken(input: {
  userId: string;
  email: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.max(30, Math.min(input.ttlSeconds ?? 5 * 60, 60 * 60));

  const header = { alg: 'HS256', typ: 'JWT' } as const;
  const payload = {
    uid: input.userId,
    email: input.email,
    iat: now,
    exp: now + ttlSeconds,
    iss: 'ivyway-web',
    aud: 'ivywayai-embed',
  } as const;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getEmbedSecret())
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

