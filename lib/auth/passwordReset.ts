import crypto from 'crypto';

export const PASSWORD_RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_EXPIRES_MS = 60 * 60 * 1000; // 1 hour

export function generatePasswordResetToken(): string {
  // URL-safe token (no padding). Node 18+ supports 'base64url'.
  return crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const ah = String(a || '').trim().toLowerCase();
  const bh = String(b || '').trim().toLowerCase();
  if (!ah || !bh) return false;
  if (ah.length !== bh.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(ah, 'hex'), Buffer.from(bh, 'hex'));
  } catch {
    return false;
  }
}

