'use server';

import { User, UserRole } from './types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEV_ADMIN_EMAIL = 'provider@gmail.com';

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Read users from file
export async function getUsers(): Promise<User[]> {
  await ensureDataDir();
  
  if (!existsSync(USERS_FILE)) {
    return [];
  }
  
  try {
    const data = await readFile(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Handle both array and object formats
    const users: User[] = Array.isArray(parsed) ? parsed : (Object.values(parsed) as User[]);

    // Dev convenience / safety: ensure the intended bootstrap admin user is actually admin.
    // This mirrors the seeded `data/users.json` and prevents accidental drift.
    // NOTE: We only ADD the admin role; we do not remove admin from other users.
    const normalized = users.map((user) => {
      if (!user) return user;

      // Normalize suspension state (canonical boolean + legacy string status)
      const isSuspended = Boolean((user as any).isSuspended) || (user as any).status === 'suspended';
      const status: 'active' | 'suspended' = isSuspended ? 'suspended' : 'active';

      // Ensure bootstrap admin roles
      if (user?.email?.toLowerCase?.() !== DEV_ADMIN_EMAIL) {
        return { ...user, isSuspended, status };
      }

      const roles = Array.isArray((user as any).roles) ? (user as any).roles : [];
      const nextRoles = Array.from(new Set([...roles, 'provider', 'admin'])) as UserRole[];
      return { ...user, roles: nextRoles, isSuspended, status };
    });

    return normalized;
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

// Write users to file
export async function saveUsers(users: User[]): Promise<void> {
  await ensureDataDir();
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// Find user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
}

// Find user by ID
export async function getUserById(id: string): Promise<User | null> {
  const users = await getUsers();
  return users.find(user => user.id === id) || null;
}

// Create new user
// NOTE: We intentionally do NOT type this as `Omit<User, ...>` because `User` includes an
// index signature (`[key: string]: any`) which makes `Omit<User, ...>` lose required fields
// under `strict` TypeScript, breaking the scripts build.
export async function createUser(
  user: Pick<User, 'id' | 'name' | 'email' | 'passwordHash' | 'roles'> & {
    roles: UserRole[];
    [key: string]: any;
  }
): Promise<User> {
  const users = await getUsers();
  const now = new Date().toISOString();
  const newUser: User = {
    ...user,
    isSuspended: Boolean((user as any).isSuspended),
    status: (user as any).status === 'suspended' || Boolean((user as any).isSuspended) ? 'suspended' : 'active',
    createdAt: now,
    updatedAt: now,
  };
  users.push(newUser);
  await saveUsers(users);
  return newUser;
}

// Update user
export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
  const users = await getUsers();
  const index = users.findIndex(user => user.id === id);
  
  if (index === -1) {
    return null;
  }
  
  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveUsers(users);
  return users[index];
}

// Delete user
export async function deleteUser(id: string): Promise<boolean> {
  const users = await getUsers();
  const initialLength = users.length;
  const filtered = users.filter(user => user.id !== id);
  
  if (filtered.length === initialLength) {
    return false; // User not found
  }
  
  await saveUsers(filtered);
  return true;
}

