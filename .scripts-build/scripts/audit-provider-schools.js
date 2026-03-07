"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const schools_1 = require("../data/schools");
function readJson(filePath) {
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}
function isProvider(u) {
    const roles = Array.isArray(u?.roles) ? u.roles : [];
    return roles.includes('provider') || roles.includes('counselor') || roles.includes('tutor');
}
function coerceArrayStrings(v) {
    if (!Array.isArray(v))
        return [];
    return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
}
function bestSchoolIdFromLegacy(name) {
    const byName = (0, schools_1.findSchoolByName)(name);
    if (byName)
        return byName.id;
    // Accept common legacy id shape: hyphen-case -> snake_case
    const hyphenAsSnake = name.trim().toLowerCase().replace(/-/g, '_');
    if (schools_1.SCHOOLS.some((s) => s.id === hyphenAsSnake))
        return hyphenAsSnake;
    // Best-effort normalization (snake_case), used only for audit suggestions.
    const normalized = name
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || null;
}
function main() {
    const args = new Set(process.argv.slice(2));
    const shouldFix = args.has('--fix');
    const usersFile = path_1.default.join(process.cwd(), 'data', 'users.json');
    const parsed = readJson(usersFile);
    const users = Array.isArray(parsed) ? parsed : Object.values(parsed);
    const providers = users.filter(isProvider);
    const issues = [];
    for (const p of providers) {
        const school_id = typeof p.school_id === 'string' ? p.school_id.trim() : '';
        const school_name = typeof p.school_name === 'string' ? p.school_name.trim() : '';
        const schoolIds = coerceArrayStrings(p.schoolIds);
        const schoolNames = coerceArrayStrings(p.schoolNames);
        const legacySchools = coerceArrayStrings(p.schools);
        const legacySingle = typeof p.school === 'string' && p.school.trim() ? [p.school.trim()] : [];
        const effectiveId = school_id || schoolIds[0] || '';
        const effectiveName = school_name || schoolNames[0] || legacySingle[0] || legacySchools[0] || '';
        // Determine suggested canonical values (first valid legacy schoolName wins).
        let suggestedId = null;
        let suggestedName = null;
        const candidates = [effectiveName, ...schoolNames, ...legacySingle, ...legacySchools].filter(Boolean);
        for (const c of candidates) {
            const sid = bestSchoolIdFromLegacy(String(c));
            if (!sid)
                continue;
            const school = schools_1.SCHOOLS.find((s) => s.id === sid);
            suggestedId = sid;
            suggestedName = school ? school.name : null;
            break;
        }
        const idMismatch = !!(suggestedId && effectiveId && suggestedId !== effectiveId);
        const missingSot = !school_id || !school_name;
        // If they have a school selected but SOT is missing or mismatched, flag it.
        if ((effectiveId || effectiveName) && (missingSot || idMismatch)) {
            issues.push({
                id: String(p.id),
                name: String(p.name || ''),
                email: typeof p.email === 'string' ? p.email : undefined,
                school_id: school_id || undefined,
                school_name: school_name || undefined,
                schoolIds,
                schoolNames,
                legacySchools: [...legacySingle, ...legacySchools],
                suggested_school_id: suggestedId,
                suggested_school_name: suggestedName,
            });
            if (shouldFix && suggestedId && suggestedName) {
                p.school_id = suggestedId;
                p.school_name = suggestedName;
                // Keep arrays in sync for backwards compatibility
                p.schoolIds = [suggestedId];
                p.schoolNames = [suggestedName];
            }
        }
    }
    // Print summary
    console.log(`[audit-provider-schools] providers=${providers.length} issues=${issues.length} fix=${shouldFix}`);
    for (const it of issues) {
        const badge = it.suggested_school_id && it.school_id && it.suggested_school_id !== it.school_id ? 'MISMATCH' : 'MISSING_SOT';
        console.log(`- ${badge} provider=${it.id} name="${it.name}" school_id="${it.school_id ?? ''}" school_name="${it.school_name ?? ''}" -> suggested "${it.suggested_school_id ?? ''}" "${it.suggested_school_name ?? ''}"`);
    }
    if (shouldFix) {
        fs_1.default.writeFileSync(usersFile, JSON.stringify(Array.isArray(parsed) ? users : Object.fromEntries(users.map((u) => [u.id, u])), null, 2));
        console.log(`[audit-provider-schools] wrote fixes to ${usersFile}`);
    }
    else {
        console.log('[audit-provider-schools] run with --fix to write suggested school_id/school_name into data/users.json');
    }
    // Targeted Yale check (requested)
    const yaleId = 'yale_university';
    const yaleProviders = providers.filter((p) => {
        const sid = (typeof p.school_id === 'string' ? p.school_id.trim() : '') || (Array.isArray(p.schoolIds) ? String(p.schoolIds[0] || '').trim() : '');
        const sname = (typeof p.school_name === 'string' ? p.school_name.trim() : '') ||
            (Array.isArray(p.schoolNames) ? String(p.schoolNames[0] || '').trim() : '');
        return /yale/i.test(sname) || sid === yaleId;
    });
    const badYale = yaleProviders.filter((p) => {
        const sid = (typeof p.school_id === 'string' ? p.school_id.trim() : '') || '';
        return sid !== yaleId;
    });
    console.log(`[audit-provider-schools] yale_candidates=${yaleProviders.length} yale_mismatch=${badYale.length}`);
    for (const p of badYale) {
        console.log(`  - yale_mismatch provider=${String(p.id)} name="${String(p.name || '')}" school_id="${String(p.school_id || '')}" school_name="${String(p.school_name || '')}"`);
    }
}
main();
