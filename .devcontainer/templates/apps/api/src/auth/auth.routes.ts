import { z } from 'zod';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Config } from '../config.js';
import type { Auth } from './auth.js';

const authConfigSchema = z.object({
  emailPassword: z.object({
    enabled: z.boolean(),
  }),
  sso: z.object({
    enabled: z.boolean(),
    providerId: z.string().optional(),
    label: z.string().optional(),
  }),
});

export const authRoutes: FastifyPluginAsyncZod<{
  auth: Auth;
  config: Config;
}> = async (app, { auth, config }) => {
  app.get(
    '/api/auth/config',
    {
      schema: {
        operationId: 'getAuthConfig',
        tags: ['auth'],
        response: {
          200: authConfigSchema.describe('Public authentication configuration'),
        },
      },
    },
    async () => {
      const context = await auth.$context;
      const sso = config.sso;
      const ssoEnabled = sso
        ? context.socialProviders.some(
            (provider) => provider.id === sso.providerId,
          )
        : false;

      return {
        emailPassword: { enabled: config.AUTH_EMAIL_PASSWORD_ENABLED },
        sso:
          sso && ssoEnabled
            ? {
                enabled: true,
                providerId: sso.providerId,
                label: sso.label,
              }
            : { enabled: false },
      };
    },
  );

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    schema: { hide: true },
    handler: async (request, reply) => {
      const headers = fromNodeHeaders(request.headers);
      headers.delete('content-length');

      const hasBody = request.method !== 'GET' && request.body !== undefined;

      const authRequest = new Request(
        new URL(request.url, config.BETTER_AUTH_URL),
        {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
          redirect: 'manual',
        },
      );

      const authResponse = await auth.handler(authRequest);

      reply.status(authResponse.status);

      for (const [key, value] of authResponse.headers) {
        const name = key.toLowerCase();
        if (
          name === 'set-cookie' ||
          name === 'content-length' ||
          name === 'content-encoding' ||
          name === 'transfer-encoding'
        ) {
          continue;
        }
        reply.header(key, value);
      }

      const setCookies = authResponse.headers.getSetCookie();
      if (setCookies.length > 0) {
        reply.header('set-cookie', setCookies);
      }

      if (authResponse.status === 204 || authResponse.status === 304) {
        return reply.send();
      }

      return reply.send(await authResponse.text());
    },
  });
};
