"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseAdmin = getSupabaseAdmin;
require("server-only");
const supabase_js_1 = require("@supabase/supabase-js");
let _admin = null;
function requireEnv(name) {
    const v = process.env[name];
    if (!v) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return v;
}
function getSupabaseAdmin() {
    if (_admin)
        return _admin;
    const url = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    _admin = (0, supabase_js_1.createClient)(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return _admin;
}
