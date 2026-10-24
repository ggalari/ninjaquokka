import { z } from 'zod';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ASSIGNABLE_ROLES } from '../../auth/permissions.js';
import { errorSchema } from '../../shared/schemas.js';
import type { AdminService } from './admin.service.js';

const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
});

export const adminRoutes: FastifyPluginAsyncZod<{
  service: AdminService;
}> = async (app, { service }) => {
  app.post(
    '/api/admin/users/:id/role',
    {
      preHandler: [app.authenticate, app.authorize('user', ['set-role'])],
      schema: {
        operationId: 'setUserRole',
        tags: ['admin'],
        security: [{ cookieAuth: [] }],
        params: z.object({ id: z.uuid() }),
        body: z.object({ role: assignableRoleSchema }),
        response: {
          200: z.object({ user: adminUserSchema }),
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
          404: errorSchema.describe('User not found'),
        },
      },
    },
    async (request, reply) => {
      const result = await service.setRole({
        actor: request.auth.user,
        targetId: request.params.id,
        role: request.body.role,
        headers: fromNodeHeaders(request.headers),
      });

      if (!result.ok) {
        return reply.code(result.status).send({ message: result.message });
      }

      return { user: result.user };
    },
  );

  app.post(
    '/api/admin/users/:id/ban',
    {
      preHandler: [app.authenticate, app.authorize('user', ['ban'])],
      schema: {
        operationId: 'setUserBan',
        tags: ['admin'],
        security: [{ cookieAuth: [] }],
        params: z.object({ id: z.uuid() }),
        body: z.object({
          banned: z.boolean(),
          reason: z.string().trim().max(500).optional(),
        }),
        response: {
          200: z.object({ user: adminUserSchema }),
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
          404: errorSchema.describe('User not found'),
        },
      },
    },
    async (request, reply) => {
      const result = await service.setBan({
        actor: request.auth.user,
        targetId: request.params.id,
        banned: request.body.banned,
        reason: request.body.reason,
        headers: fromNodeHeaders(request.headers),
      });

      if (!result.ok) {
        return reply.code(result.status).send({ message: result.message });
      }

      return { user: result.user };
    },
  );
};
