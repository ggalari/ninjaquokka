import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';
import { createAuth, DISABLED_ADMIN_PATHS } from '../src/auth/auth.js';
import type { Auth } from '../src/auth/auth.js';
import type { Config } from '../src/config.js';
import type { PrismaClient } from '../src/db.js';
import type { AuthContext, AuthGuards } from '../src/auth/auth.guard.js';
import { adminRoutes } from '../src/modules/admin/admin.routes.js';
import {
  createAdminService,
  type AdminUser,
} from '../src/modules/admin/admin.service.js';

const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const superadminId = '33333333-3333-4333-8333-333333333333';

function makeAuth(users: Map<string, AdminUser>, wrapResults = true) {
  const calls = {
    setRole: [] as Array<{ userId: string; role: string }>,
    ban: [] as Array<{ userId: string; banned: boolean }>,
  };

  const result = (user: AdminUser) => (wrapResults ? { user } : user);

  const auth = {
    api: {
      getUser: async ({ query }: { query: { id: string } }) => {
        const user = users.get(query.id);
        if (!user) throw new Error('User not found');
        return user;
      },
      setRole: async ({ body }: { body: { userId: string; role: string } }) => {
        calls.setRole.push(body);
        const user = users.get(body.userId);
        if (!user) throw new Error('User not found');
        const updated = { ...user, role: body.role };
        users.set(body.userId, updated);
        return result(updated);
      },
      banUser: async ({ body }: { body: { userId: string } }) => {
        calls.ban.push({ userId: body.userId, banned: true });
        const user = users.get(body.userId);
        if (!user) throw new Error('User not found');
        const updated = { ...user, banned: true };
        users.set(body.userId, updated);
        return result(updated);
      },
      unbanUser: async ({ body }: { body: { userId: string } }) => {
        calls.ban.push({ userId: body.userId, banned: false });
        const user = users.get(body.userId);
        if (!user) throw new Error('User not found');
        const updated = { ...user, banned: false };
        users.set(body.userId, updated);
        return result(updated);
      },
    },
  } as unknown as Auth;

  return { auth, calls };
}

async function buildTestApp(
  actorRole: string,
  users: Map<string, AdminUser>,
  wrapResults = true,
) {
  const { auth, calls } = makeAuth(users, wrapResults);
  const app = Fastify().withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const authenticate: AuthGuards['authenticate'] = async (request) => {
    request.auth = {
      user: {
        id: actorId,
        name: 'Actor',
        email: 'actor@example.com',
        emailVerified: true,
        image: null,
        role: actorRole,
      },
      session: {
        id: 'session',
        token: 'token',
        userId: actorId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    } as AuthContext;
  };
  const authorize: AuthGuards['authorize'] = () => async () => {};

  app.decorate('authenticate', authenticate);
  app.decorate('authorize', authorize);

  await app.register(adminRoutes, {
    service: createAdminService(auth),
  });

  return { app, calls };
}

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: targetId,
    name: 'Target',
    email: 'target@example.com',
    role: 'user',
    banned: false,
    banReason: null,
    ...overrides,
  };
}

describe('raw admin endpoints', () => {
  it('are disabled so they cannot bypass domain policy', async () => {
    expect(DISABLED_ADMIN_PATHS).toContain('/admin/set-role');
    expect(DISABLED_ADMIN_PATHS).toContain('/admin/ban-user');
    expect(DISABLED_ADMIN_PATHS).toContain('/admin/unban-user');

    const auth = createAuth(
      {} as PrismaClient,
      {
        PORT: 3000,
        DATABASE_URL: 'postgresql://localhost/test',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        BETTER_AUTH_URL: 'http://localhost:3000',
        TRUSTED_ORIGINS: ['http://localhost:5173'],
        AUTH_EMAIL_PASSWORD_ENABLED: true,
      } as Config,
    );

    expect(auth.options.disabledPaths).toEqual([...DISABLED_ADMIN_PATHS]);

    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/admin/set-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: targetId, role: 'superadmin' }),
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe('role route', () => {
  it('rejects superadmin assignment at the schema boundary', async () => {
    const users = new Map([[targetId, user()]]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/role`,
      payload: { role: 'superadmin' },
    });

    expect(response.statusCode).toBe(400);
    expect(calls.setRole).toHaveLength(0);
    await app.close();
  });

  it('rejects a normal user even if the permission gate is bypassed', async () => {
    const users = new Map([[targetId, user()]]);
    const { app, calls } = await buildTestApp('user', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/role`,
      payload: { role: 'admin' },
    });

    expect(response.statusCode).toBe(403);
    expect(calls.setRole).toHaveLength(0);
    await app.close();
  });

  it('rejects changing a superadmin', async () => {
    const users = new Map([
      [superadminId, user({ id: superadminId, role: 'superadmin' })],
    ]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${superadminId}/role`,
      payload: { role: 'user' },
    });

    expect(response.statusCode).toBe(403);
    expect(calls.setRole).toHaveLength(0);
    await app.close();
  });

  it('rejects self role changes', async () => {
    const users = new Map([[actorId, user({ id: actorId, role: 'admin' })]]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${actorId}/role`,
      payload: { role: 'user' },
    });

    expect(response.statusCode).toBe(403);
    expect(calls.setRole).toHaveLength(0);
    await app.close();
  });

  it('allows an admin to assign a moderator', async () => {
    const users = new Map([[targetId, user()]]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/role`,
      payload: { role: 'moderator' },
    });

    expect(response.statusCode).toBe(200);
    expect(calls.setRole).toEqual([{ userId: targetId, role: 'moderator' }]);
    await app.close();
  });

  it('accepts a direct user result from setRole', async () => {
    const users = new Map([[targetId, user()]]);
    const { app } = await buildTestApp('admin', users, false);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/role`,
      payload: { role: 'moderator' },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe('ban route', () => {
  it('rejects self-ban', async () => {
    const users = new Map([[actorId, user({ id: actorId, role: 'admin' })]]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${actorId}/ban`,
      payload: { banned: true },
    });

    expect(response.statusCode).toBe(403);
    expect(calls.ban).toHaveLength(0);
    await app.close();
  });

  it('rejects banning a superadmin', async () => {
    const users = new Map([
      [superadminId, user({ id: superadminId, role: 'superadmin' })],
    ]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${superadminId}/ban`,
      payload: { banned: true },
    });

    expect(response.statusCode).toBe(403);
    expect(calls.ban).toHaveLength(0);
    await app.close();
  });

  it('allows an admin to ban a normal user', async () => {
    const users = new Map([[targetId, user()]]);
    const { app, calls } = await buildTestApp('admin', users);

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/ban`,
      payload: { banned: true, reason: 'spam' },
    });

    expect(response.statusCode).toBe(200);
    expect(calls.ban).toEqual([{ userId: targetId, banned: true }]);
    await app.close();
  });

  it('accepts direct user results from banUser and unbanUser', async () => {
    const users = new Map([[targetId, user({ banned: true })]]);
    const { app } = await buildTestApp('admin', users, false);

    const unban = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/ban`,
      payload: { banned: false },
    });
    expect(unban.statusCode).toBe(200);

    const ban = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/ban`,
      payload: { banned: true },
    });
    expect(ban.statusCode).toBe(200);

    await app.close();
  });
});
