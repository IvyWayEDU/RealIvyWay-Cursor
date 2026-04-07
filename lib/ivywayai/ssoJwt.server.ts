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

function getSsoJwtSecret(): string {
  const secret = process.env.SSO_JWT_SECRET;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ivyway-web] SSO_JWT_SECRET is set:', Boolean(secret));
  }
  if (!secret) {
    throw new Error('Missing SSO_JWT_SECRET. Set it to generate IvyWayAI SSO tokens.');
  }
  return secret;
}

export function createIvyWayAiSsoJwt(input: {
  userId: string | number;
  email: string;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' } as const;
  if (!input.email) {
    throw new Error('Cannot generate IvyWayAI SSO JWT: missing email');
  }

  // IMPORTANT: Payload must EXACTLY match what IvyWayAI expects.
  const payload = {
    email: input.email,
    sub: String(input.userId),
    exp: Math.floor(Date.now() / 1000) + (60 * 60),
  } as const;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getSsoJwtSecret())
    .update(signingInput)
    .digest();

  const token = `${signingInput}.${base64UrlEncode(signature)}`;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ivyway-web] Generated IvyWayAI SSO JWT');
  }
  return token;
}

