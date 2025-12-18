import crypto from 'crypto';

// Simple password hashing using Node.js crypto
// In production, consider using bcrypt or argon2
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, hashValue] = hash.split(':');
  if (!salt || !hashValue) return false;
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hashValue === verifyHash;
}

