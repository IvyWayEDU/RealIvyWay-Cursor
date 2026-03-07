"use strict";
/**
 * One-off admin promotion script (no API endpoint).
 *
 * Usage:
 *   tsc -p tsconfig.scripts.json && node .scripts-build/scripts/promote-admin.js onealmutombo@ivywayedu.com
 */
Object.defineProperty(exports, "__esModule", { value: true });
const setAdminRole_1 = require("../lib/auth/setAdminRole");
async function main() {
    const email = (process.argv[2] || '').trim();
    if (!email) {
        console.error('Usage: promote-admin <email>');
        process.exit(1);
    }
    const result = await (0, setAdminRole_1.setAdminRoleByEmail)(email);
    if (!result.success) {
        console.error(result.message);
        process.exit(1);
    }
    console.log(result.message);
}
main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
