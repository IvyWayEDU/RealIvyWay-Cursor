'use server';

import { User, UserRole } from './types';
import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

const DEV_ADMIN_EMAIL = 'provider@gmail.com';

function primaryRoleForUserRoles(roles: unknown): string {
  const arr = Array.isArray(roles) ? roles.map((r) => String(r || '').trim()).filter(Boolean) : [];
  const set = new Set(arr);
  if (set.has('admin')) return 'admin';
  if (set.has('provider') || set.has('counselor') || set.has('tutor')) return 'provider';
  if (set.has('student')) return 'student';
  return arr[0] || 'student';
}

export async function getUsers(): Promise<User[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('users').select('data');
  if (error) {
    console.error('[auth.storage] Error reading users from Supabase:', error);
    throw error;
  }

  const users: User[] = (data ?? [])
    .map((row: any) => row?.data)
    .filter(Boolean) as User[];

  // Dev convenience / safety: ensure the intended bootstrap admin user is actually admin.
  // NOTE: We only ADD the admin role; we do not remove admin from other users.
  const normalized = users.map((user) => {
    if (!user) return user;

    const isSuspended = Boolean((user as any).isSuspended) || (user as any).status === 'suspended';
    const status: 'active' | 'suspended' = isSuspended ? 'suspended' : 'active';

    if (user?.email?.toLowerCase?.() !== DEV_ADMIN_EMAIL) {
      return { ...user, isSuspended, status };
    }

    const roles = Array.isArray((user as any).roles) ? (user as any).roles : [];
    const nextRoles = Array.from(new Set([...roles, 'provider', 'admin'])) as UserRole[];
    return { ...user, roles: nextRoles, isSuspended, status };
  });

  // Best-effort: persist the bootstrap admin normalization so the DB doesn't drift.
  try {
    const admin = normalized.find((u) => u?.email?.toLowerCase?.() === DEV_ADMIN_EMAIL);
    if (admin?.id) {
      await updateUser(admin.id, { roles: admin.roles } as any);
    }
  } catch {
    // ignore
  }

  return normalized;
}

export async function saveUsers(users: User[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const rows = (users || [])
    .filter(Boolean)
    .map((u) => ({
      id: String((u as any).id || '').trim(),
      email: String((u as any).email || '').trim().toLowerCase(),
      role: primaryRoleForUserRoles((u as any).roles),
      data: u,
      created_at: (u as any).createdAt || now,
      updated_at: (u as any).updatedAt || now,
    }))
    .filter((r) => r.id && r.email);

  if (rows.length === 0) return;

  const { error } = await supabase.from('users').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

// Find user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('users').select('*').eq('email', e).single();

  // `single()` returns an error when no rows match; treat that as "not found", not a Supabase failure.
  if (error) {
    const code = (error as any)?.code;
    const status = (error as any)?.status;
    if (code === 'PGRST116' || status === 406) return null;
    throw error;
  }

  return ((data as any)?.data as User) || null;
}

// Find user by ID
export async function getUserById(id: string): Promise<User | null> {
  const uid = String(id || '').trim();
  if (!uid) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('users').select('data').eq('id', uid).maybeSingle();
  if (error) throw error;
  return ((data as any)?.data as User) || null;
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
  const now = new Date().toISOString();
  const newUser: User = {
    ...user,
    isSuspended: Boolean((user as any).isSuspended),
    status: (user as any).status === 'suspended' || Boolean((user as any).isSuspended) ? 'suspended' : 'active',
    createdAt: now,
    updatedAt: now,
  };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .insert({
      id: String(newUser.id || '').trim(),
      email: String(newUser.email || '').trim().toLowerCase(),
      role: primaryRoleForUserRoles((newUser as any).roles),
      data: newUser,
      created_at: now,
      updated_at: now,
    });
  if (error) throw error;
  return newUser;
}

// Update user
export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
  const uid = String(id || '').trim();
  if (!uid) return null;
  const existing = await getUserById(uid);
  if (!existing) return null;

  const merged: User = {
    ...(existing as any),
    ...(updates as any),
    updatedAt: new Date().toISOString(),
  } as User;

  const supabase = getSupabaseAdmin();
  const email = String(((merged as any).email || (existing as any).email || '') as any)
    .trim()
    .toLowerCase();
  const { error } = await supabase
    .from('users')
    .update({
      email,
      role: primaryRoleForUserRoles((merged as any).roles),
      data: merged,
    })
    .eq('id', uid);
  if (error) throw error;
  return merged;
}

// Delete user
export async function deleteUser(id: string): Promise<boolean> {
  const uid = String(id || '').trim();
  if (!uid) return false;
  const supabase = getSupabaseAdmin();
  const { error, count } = await supabase.from('users').delete({ count: 'exact' }).eq('id', uid);
  if (error) throw error;
  return (count ?? 0) > 0;
}

