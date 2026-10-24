import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/health',
    {
      schema: {
        operationId: 'getHealth',
        tags: ['health'],
        response: {
          200: z.object({ status: z.literal('ok') }).describe('Health status'),
        },
      },
    },
    async () => ({ status: 'ok' as const }),
  );
};
