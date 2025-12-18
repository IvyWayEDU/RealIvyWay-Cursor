import { UserRole } from './types';

/**
 * Determines the dashboard route based on user roles
 * Priority: Admin > Student > Provider (Tutor/Counselor)
 */
export function getDashboardRoute(roles: UserRole[]): string {
  if (roles.includes('admin')) {
    return '/dashboard/admin';
  }
  
  if (roles.includes('student')) {
    return '/dashboard/student';
  }
  
  // Tutor, Counselor, or both go to provider dashboard
  if (roles.includes('tutor') || roles.includes('counselor')) {
    return '/dashboard/provider';
  }
  
  // Default fallback
  return '/dashboard/student';
}

/**
 * Validates that roles are valid and follow business rules
 */
export function validateRoles(roles: UserRole[]): { valid: boolean; error?: string } {
  if (roles.length === 0) {
    return { valid: false, error: 'At least one role must be selected' };
  }
  
  // Admin role cannot be combined with other roles (only manual assignment)
  if (roles.includes('admin') && roles.length > 1) {
    return { valid: false, error: 'Admin role cannot be combined with other roles' };
  }
  
  // Student cannot be combined with Tutor/Counselor
  if (roles.includes('student') && (roles.includes('tutor') || roles.includes('counselor'))) {
    return { valid: false, error: 'Student role cannot be combined with Tutor or Counselor roles' };
  }
  
  return { valid: true };
}

/**
 * Gets the display role from user roles for dashboard navigation
 * Priority: Admin > Student > Provider
 */
export function getDisplayRole(roles: UserRole[]): 'student' | 'provider' | 'admin' {
  if (roles.includes('admin')) {
    return 'admin';
  }
  
  if (roles.includes('student')) {
    return 'student';
  }
  
  // Tutor, Counselor, or both go to provider dashboard
  if (roles.includes('tutor') || roles.includes('counselor')) {
    return 'provider';
  }
  
  // Default fallback
  return 'student';
}

/**
 * Checks if user has access to a specific dashboard
 */
export function hasAccessToDashboard(
  dashboardRole: 'student' | 'provider' | 'admin',
  userRoles: UserRole[]
): boolean {
  switch (dashboardRole) {
    case 'admin':
      return userRoles.includes('admin');
    case 'student':
      return userRoles.includes('student');
    case 'provider':
      return userRoles.includes('tutor') || userRoles.includes('counselor');
    default:
      return false;
  }
}

