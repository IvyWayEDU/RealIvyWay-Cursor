"use strict";
/**
 * Set Admin Role Utility
 *
 * Server-side utility to set admin role for a user by email.
 * Persists changes to the database.
 *
 * Usage:
 *   - Import and call: await setAdminRoleByEmail('management@ivywayedu.com')
 *   - Can be called from API routes or server-side code
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAdminRoleByEmail = setAdminRoleByEmail;
const storage_1 = require("./storage");
/**
 * Sets admin role for a user by email address.
 * Adds 'admin' to the user's roles array if not already present.
 *
 * @param email - The email address of the user to set as admin
 * @returns Object with success status and message
 */
async function setAdminRoleByEmail(email) {
    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
        const errorMsg = '[SET_ADMIN_ROLE] Error: Email address is required';
        console.error(errorMsg);
        return {
            success: false,
            message: errorMsg,
        };
    }
    try {
        // Find user by email
        const user = await (0, storage_1.getUserByEmail)(normalizedEmail);
        if (!user) {
            const errorMsg = `[SET_ADMIN_ROLE] Error: User with email "${normalizedEmail}" not found`;
            console.error(errorMsg);
            return {
                success: false,
                message: errorMsg,
            };
        }
        // Check if user already has admin role
        if (user.roles.includes('admin')) {
            const successMsg = `[SET_ADMIN_ROLE] Success: User "${normalizedEmail}" already has admin role`;
            console.log(successMsg);
            return {
                success: true,
                message: successMsg,
            };
        }
        // Per business rules, admin role should be exclusive.
        const updatedRoles = ['admin'];
        // Update user with admin role (persists to database)
        await (0, storage_1.updateUser)(user.id, { roles: updatedRoles });
        const successMsg = `[SET_ADMIN_ROLE] Success: User "${normalizedEmail}" (${user.id}) has been granted admin role. Roles: ${updatedRoles.join(', ')}`;
        console.log(successMsg);
        return {
            success: true,
            message: successMsg,
        };
    }
    catch (error) {
        const errorMsg = `[SET_ADMIN_ROLE] Error: Failed to set admin role for "${normalizedEmail}": ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        return {
            success: false,
            message: errorMsg,
        };
    }
}
