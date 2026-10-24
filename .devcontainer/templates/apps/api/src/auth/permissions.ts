import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

export const statement = {
  ...defaultStatements,
  profile: ['read', 'update'],
  note: ['create', 'read', 'update', 'delete', 'manage'],
  system: ['manage'],
} as const;

export type PermissionStatements = typeof statement;
export type Resource = keyof PermissionStatements;
export type Action<R extends Resource> = PermissionStatements[R][number];

export const ac = createAccessControl(statement);

export const user = ac.newRole({
  profile: ['read', 'update'],
  note: ['create', 'read', 'update', 'delete'],
  user: [],
  session: [],
  system: [],
});

export const moderator = ac.newRole({
  profile: ['read', 'update'],
  note: ['create', 'read', 'update', 'delete', 'manage'],
  user: ['get', 'list'],
  session: [],
  system: [],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  profile: ['read', 'update'],
  note: ['create', 'read', 'update', 'delete', 'manage'],
  system: [],
});

export const superadmin = ac.newRole({
  ...adminAc.statements,
  user: [...adminAc.statements.user, 'impersonate-admins'],
  profile: ['read', 'update'],
  note: ['create', 'read', 'update', 'delete', 'manage'],
  system: ['manage'],
});

export const roles = {
  user,
  moderator,
  admin,
  superadmin,
} as const;

export type RoleName = keyof typeof roles;

const roleNames = Object.keys(roles) as RoleName[];

export const ASSIGNABLE_ROLES = [
  'user',
  'moderator',
  'admin',
] as const satisfies readonly RoleName[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function parseRoles(
  value: string | string[] | null | undefined,
): RoleName[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : value.split(',');
  return values
    .map((role) => role.trim())
    .filter((role): role is RoleName => roleNames.includes(role as RoleName));
}

export function hasRole(
  value: string | string[] | null | undefined,
  role: RoleName,
): boolean {
  return parseRoles(value).includes(role);
}

export function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export function canModerateUser(input: {
  actorId: string;
  actorRoles: string | string[] | null | undefined;
  targetId: string;
  targetRoles: string | string[] | null | undefined;
}): boolean {
  const isAdmin = hasRole(input.actorRoles, 'admin');
  const isSuperadmin = hasRole(input.actorRoles, 'superadmin');
  if (!isAdmin && !isSuperadmin) return false;
  if (input.actorId === input.targetId) return false;
  return !hasRole(input.targetRoles, 'superadmin');
}

export function canChangeUserRole(input: {
  actorId: string;
  actorRoles: string | string[] | null | undefined;
  targetId: string;
  targetRoles: string | string[] | null | undefined;
  nextRole: string;
}): boolean {
  return canModerateUser(input) && isAssignableRole(input.nextRole);
}
