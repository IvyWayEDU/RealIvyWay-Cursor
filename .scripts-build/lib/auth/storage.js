"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = getUsers;
exports.saveUsers = saveUsers;
exports.getUserByEmail = getUserByEmail;
exports.getUserById = getUserById;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
const admin_server_1 = require("@/lib/supabase/admin.server");
const DEV_ADMIN_EMAIL = 'provider@gmail.com';
function primaryRoleForUserRoles(roles) {
    const arr = Array.isArray(roles) ? roles.map((r) => String(r || '').trim()).filter(Boolean) : [];
    const set = new Set(arr);
    if (set.has('admin'))
        return 'admin';
    if (set.has('provider') || set.has('counselor') || set.has('tutor'))
        return 'provider';
    if (set.has('student'))
        return 'student';
    return arr[0] || 'student';
}
async function getUsers() {
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { data, error } = await supabase.from('users').select('data');
    if (error) {
        console.error('[auth.storage] Error reading users from Supabase:', error);
        return [];
    }
    const users = (data ?? [])
        .map((row) => row?.data)
        .filter(Boolean);
    // Dev convenience / safety: ensure the intended bootstrap admin user is actually admin.
    // NOTE: We only ADD the admin role; we do not remove admin from other users.
    const normalized = users.map((user) => {
        if (!user)
            return user;
        const isSuspended = Boolean(user.isSuspended) || user.status === 'suspended';
        const status = isSuspended ? 'suspended' : 'active';
        if (user?.email?.toLowerCase?.() !== DEV_ADMIN_EMAIL) {
            return { ...user, isSuspended, status };
        }
        const roles = Array.isArray(user.roles) ? user.roles : [];
        const nextRoles = Array.from(new Set([...roles, 'provider', 'admin']));
        return { ...user, roles: nextRoles, isSuspended, status };
    });
    // Best-effort: persist the bootstrap admin normalization so the DB doesn't drift.
    try {
        const admin = normalized.find((u) => u?.email?.toLowerCase?.() === DEV_ADMIN_EMAIL);
        if (admin?.id) {
            await updateUser(admin.id, { roles: admin.roles });
        }
    }
    catch {
        // ignore
    }
    return normalized;
}
async function saveUsers(users) {
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const now = new Date().toISOString();
    const rows = (users || [])
        .filter(Boolean)
        .map((u) => ({
        id: String(u.id || '').trim(),
        email: String(u.email || '').trim().toLowerCase(),
        role: primaryRoleForUserRoles(u.roles),
        data: u,
        created_at: u.createdAt || now,
        updated_at: u.updatedAt || now,
    }))
        .filter((r) => r.id && r.email);
    if (rows.length === 0)
        return;
    const { error } = await supabase.from('users').upsert(rows, { onConflict: 'id' });
    if (error)
        throw error;
}
// Find user by email
async function getUserByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e)
        return null;
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { data, error } = await supabase.from('users').select('data').eq('email', e).maybeSingle();
    if (error)
        throw error;
    return data?.data || null;
}
// Find user by ID
async function getUserById(id) {
    const uid = String(id || '').trim();
    if (!uid)
        return null;
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { data, error } = await supabase.from('users').select('data').eq('id', uid).maybeSingle();
    if (error)
        throw error;
    return data?.data || null;
}
// Create new user
// NOTE: We intentionally do NOT type this as `Omit<User, ...>` because `User` includes an
// index signature (`[key: string]: any`) which makes `Omit<User, ...>` lose required fields
// under `strict` TypeScript, breaking the scripts build.
async function createUser(user) {
    const now = new Date().toISOString();
    const newUser = {
        ...user,
        isSuspended: Boolean(user.isSuspended),
        status: user.status === 'suspended' || Boolean(user.isSuspended) ? 'suspended' : 'active',
        createdAt: now,
        updatedAt: now,
    };
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { error } = await supabase.from('users').insert({
        id: String(newUser.id || '').trim(),
        email: String(newUser.email || '').trim().toLowerCase(),
        role: primaryRoleForUserRoles(newUser.roles),
        data: newUser,
        created_at: now,
        updated_at: now,
    });
    if (error)
        throw error;
    return newUser;
}
// Update user
async function updateUser(id, updates) {
    const uid = String(id || '').trim();
    if (!uid)
        return null;
    const existing = await getUserById(uid);
    if (!existing)
        return null;
    const merged = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const email = String((merged.email || existing.email || ''))
        .trim()
        .toLowerCase();
    const { error } = await supabase
        .from('users')
        .update({
        email,
        role: primaryRoleForUserRoles(merged.roles),
        data: merged,
    })
        .eq('id', uid);
    if (error)
        throw error;
    return merged;
}
// Delete user
async function deleteUser(id) {
    const uid = String(id || '').trim();
    if (!uid)
        return false;
    const supabase = (0, admin_server_1.getSupabaseAdmin)();
    const { error, count } = await supabase.from('users').delete({ count: 'exact' }).eq('id', uid);
    if (error)
        throw error;
    return (count ?? 0) > 0;
}
