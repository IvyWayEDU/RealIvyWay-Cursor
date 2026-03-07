export type UserRole = 'student' | 'provider' | 'tutor' | 'counselor' | 'admin';

/**
 * Canonical single-role view used by UI route guards and sidebar rendering.
 * Derived from `roles` with priority: admin > student > provider.
 */
export type PrimaryRole = 'student' | 'provider' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
  /**
   * Admin-controlled account suspension flag.
   * Canonical boolean used by auth/session checks.
   * Defaults to false when absent in dev JSON.
   */
  isSuspended?: boolean;
  /**
   * Admin-controlled account status.
   * Defaults to 'active' when absent in dev JSON.
   * Legacy string form; kept for backwards compatibility.
   */
  status?: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;

  // Stripe (students)
  stripeCustomerId?: string;

  // Provider profile fields (optional; present in dev JSON for counselors/virtual tours)
  /**
   * Single source of truth for provider school matching + display.
   * Availability filtering MUST use `school_id` (exact match).
   */
  school_id?: string;
  school_name?: string;
  schoolIds?: string[];
  schoolNames?: string[];
  schools?: string[]; // legacy field

  // Legacy provider role booleans (some codepaths still check these)
  isTutor?: boolean;
  isCounselor?: boolean;

  // Provider onboarding fields (optional; stored in dev JSON)
  profilePhotoUrl?: string | null;
  profilePhotoSkipped?: boolean;

  // Allow additional legacy/provider fields without breaking builds
  [key: string]: any;
}

export interface Session {
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
  /**
   * Convenience view for Next.js route guards that expect `session.user.role`.
   * Kept in sync with `roles` at read time (cookie -> session).
   */
  user: {
    id: string;
    email: string;
    name: string;
    roles: UserRole[];
    role: PrimaryRole;
  };
}

