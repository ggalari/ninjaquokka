import type { Auth } from '../../auth/auth.js';
import {
  canChangeUserRole,
  canModerateUser,
  type AssignableRole,
} from '../../auth/permissions.js';

export type AdminActor = {
  id: string;
  role?: string | string[] | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean;
  banReason: string | null;
};

type AdminFailure = {
  ok: false;
  status: 403 | 404;
  message: string;
};

type AdminSuccess = {
  ok: true;
  user: AdminUser;
};

export type AdminResult = AdminFailure | AdminSuccess;

/**
 * Better Auth returns the user object directly from `getUser` in 1.7.x.
 * Accept the wrapped shapes too so an API change cannot turn the superadmin
 * target check into a silent no-op.
 */
function normalizeUser(value: unknown): AdminUser | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const nested =
    record.user && typeof record.user === 'object'
      ? record.user
      : record.data && typeof record.data === 'object'
        ? record.data
        : record;

  const user = nested as Record<string, unknown>;
  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string'
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: typeof user.role === 'string' ? user.role : null,
    banned: user.banned === true,
    banReason: typeof user.banReason === 'string' ? user.banReason : null,
  };
}

export function createAdminService(auth: Auth) {
  const getUser = async (
    id: string,
    headers: Headers,
  ): Promise<AdminUser | null> => {
    try {
      return normalizeUser(await auth.api.getUser({ query: { id }, headers }));
    } catch {
      return null;
    }
  };

  return {
    getUser,

    setRole: async (input: {
      actor: AdminActor;
      targetId: string;
      role: AssignableRole;
      headers: Headers;
    }): Promise<AdminResult> => {
      const target = await getUser(input.targetId, input.headers);
      if (!target) {
        return { ok: false, status: 404, message: 'User not found' };
      }

      const allowed = canChangeUserRole({
        actorId: input.actor.id,
        actorRoles: input.actor.role,
        targetId: target.id,
        targetRoles: target.role,
        nextRole: input.role,
      });

      if (!allowed) {
        return { ok: false, status: 403, message: 'Forbidden' };
      }

      const result = await auth.api.setRole({
        body: { userId: input.targetId, role: input.role },
        headers: input.headers,
      });

      // 1.7.x returns { user }, but accept a direct user object too.
      const user = normalizeUser(result);
      if (!user) {
        return { ok: false, status: 404, message: 'User not found' };
      }

      return { ok: true, user };
    },

    setBan: async (input: {
      actor: AdminActor;
      targetId: string;
      banned: boolean;
      reason?: string;
      headers: Headers;
    }): Promise<AdminResult> => {
      const target = await getUser(input.targetId, input.headers);
      if (!target) {
        return { ok: false, status: 404, message: 'User not found' };
      }

      const allowed = canModerateUser({
        actorId: input.actor.id,
        actorRoles: input.actor.role,
        targetId: target.id,
        targetRoles: target.role,
      });

      if (!allowed) {
        return { ok: false, status: 403, message: 'Forbidden' };
      }

      const result = input.banned
        ? await auth.api.banUser({
            body: {
              userId: input.targetId,
              banReason: input.reason,
            },
            headers: input.headers,
          })
        : await auth.api.unbanUser({
            body: { userId: input.targetId },
            headers: input.headers,
          });

      // 1.7.x returns { user }, but accept a direct user object too.
      const user = normalizeUser(result);
      if (!user) {
        return { ok: false, status: 404, message: 'User not found' };
      }

      return { ok: true, user };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
