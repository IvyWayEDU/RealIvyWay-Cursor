export type UserRole = 'student' | 'tutor' | 'counselor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
}

