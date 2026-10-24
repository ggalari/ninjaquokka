import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Auth } from '../../auth/auth.js';
import { errorSchema } from '../../shared/schemas.js';
import { meSchema, updateProfileSchema } from './profile.schemas.js';
import type { ProfileService } from './profile.service.js';

export const profileRoutes: FastifyPluginAsyncZod<{
  auth: Auth;
  service: ProfileService;
}> = async (app, { auth, service }) => {
  app.get(
    '/api/me',
    {
      preHandler: app.authenticate,
      schema: {
        operationId: 'getMe',
        tags: ['profile'],
        security: [{ cookieAuth: [] }],
        response: {
          200: meSchema,
          401: errorSchema.describe('Unauthorized'),
        },
      },
    },
    async (request) => {
      const { user } = request.auth;
      const profile = await service.getOrCreate(user.id);
      return service.toMe(user, profile);
    },
  );

  app.patch(
    '/api/me/profile',
    {
      preHandler: [app.authenticate, app.authorize('profile', ['update'])],
      schema: {
        operationId: 'updateMyProfile',
        tags: ['profile'],
        security: [{ cookieAuth: [] }],
        body: updateProfileSchema,
        response: {
          200: meSchema,
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
        },
      },
    },
    async (request) => {
      const { user } = request.auth;

      if (request.body.image !== undefined) {
        await auth.api.updateUser({
          body: { image: request.body.image },
          headers: fromNodeHeaders(request.headers),
        });
      }

      await service.getOrCreate(user.id);
      const profile = await service.update(user.id, request.body);
      return service.toMe(user, profile, request.body.image);
    },
  );
};
