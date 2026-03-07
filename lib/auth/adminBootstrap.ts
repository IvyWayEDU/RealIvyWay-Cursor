/**
 * Admin Bootstrap Utility
 * 
 * Server-only utility to promote a user to admin role.
 * Only runs in development OR when ADMIN_BOOTSTRAP_EMAIL environment variable is set.
 * 
 * Usage:
 *   - Set ADMIN_BOOTSTRAP_EMAIL=admin@example.com
 *   - Call bootstrapAdmin() during server startup or in a one-time script
 */

import { getUserByEmail, updateUser } from './storage';
import { UserRole } from './types';

/**
 * Promotes a user to admin role by email address.
 * 
 * Security:
 * - Only runs in development (NODE_ENV !== 'production') OR
 * - When ADMIN_BOOTSTRAP_EMAIL environment variable is set
 * 
 * Safety checks:
 * - User must exist
 * - Exactly one user must match (email must be unique)
 * - Fails gracefully with clear error messages
 * 
 * @param email - The email address of the user to promote
 * @returns Object with success status and message
 */
export async function bootstrapAdmin(email: string): Promise<{ success: boolean; message: string }> {
  // SECURITY: Only allow in development or when ADMIN_BOOTSTRAP_EMAIL is set
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const hasBootstrapEnv = !!process.env.ADMIN_BOOTSTRAP_EMAIL;
  
  if (!isDevelopment && !hasBootstrapEnv) {
    const errorMsg = '[ADMIN_BOOTSTRAP] Error: Admin bootstrap is only available in development or when ADMIN_BOOTSTRAP_EMAIL is set';
    console.error(errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  }

  // Normalize email (trim and lowercase)
  const normalizedEmail = email.trim().toLowerCase();
  
  if (!normalizedEmail) {
    const errorMsg = '[ADMIN_BOOTSTRAP] Error: Email address is required';
    console.error(errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  }

  try {
    // Find user by email
    const user = await getUserByEmail(normalizedEmail);
    
    if (!user) {
      const errorMsg = `[ADMIN_BOOTSTRAP] Error: User with email "${normalizedEmail}" not found`;
      console.error(errorMsg);
      return {
        success: false,
        message: errorMsg,
      };
    }

    // Check if user is already admin
    if (user.roles.includes('admin')) {
      const successMsg = `[ADMIN_BOOTSTRAP] Success: User "${normalizedEmail}" is already an admin`;
      console.log(successMsg);
      return {
        success: true,
        message: successMsg,
      };
    }

    // Add admin role to user
    const updatedRoles: UserRole[] = [...user.roles, 'admin'];
    
    // Update user with admin role
    await updateUser(user.id, { roles: updatedRoles });

    const successMsg = `[ADMIN_BOOTSTRAP] Success: User "${normalizedEmail}" (${user.id}) has been promoted to admin`;
    console.log(successMsg);
    
    return {
      success: true,
      message: successMsg,
    };
  } catch (error) {
    const errorMsg = `[ADMIN_BOOTSTRAP] Error: Failed to promote user "${normalizedEmail}": ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  }
}

/**
 * Bootstrap admin from environment variable.
 * 
 * If ADMIN_BOOTSTRAP_EMAIL is set, automatically promotes that user to admin.
 * Safe to call multiple times (idempotent).
 */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  
  if (!bootstrapEmail) {
    // Not an error - env var is optional
    return;
  }

  const result = await bootstrapAdmin(bootstrapEmail);
  
  if (!result.success) {
    console.error(result.message);
    // Don't throw - allow application to continue
    // In production, you might want to fail fast here
  }
}


