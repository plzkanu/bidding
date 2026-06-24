export type UserRole = "admin" | "user";

export interface User {
  id: string;
  passwordHash: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface UserPublic {
  id: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  department: string;
  role: UserRole;
}

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    name: user.name,
    department: user.department ?? "",
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

