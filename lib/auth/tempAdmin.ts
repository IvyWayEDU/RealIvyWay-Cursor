/**
 * TEMP_ADMIN_MODE: Temporary admin override for local testing
 * 
 * This is a temporary helper for local development without Supabase.
 * DO NOT use in production. This will be removed when database is connected.
 */

/**
 * TEMP_ADMIN_MODE: Check if a user ID is the temporary admin
 * @param userId - The user ID to check
 * @returns true if the user is the temp admin
 */
export function isTempAdmin(userId: string): boolean {
  // TEMP_ADMIN_MODE: Hardcoded admin user ID for local testing
  const TEMP_ADMIN_USER_ID = '7ef29c66-f13f-4df2-87ae-ae8061527a4b';
  return userId === TEMP_ADMIN_USER_ID;
}





