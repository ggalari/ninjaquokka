import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createAuth } from './auth/auth.js';
import { createAuthGuards } from './auth/auth.guard.js';
import { authRoutes } from './auth/auth.routes.js';
import type { Config } from './config.js';
import type { PrismaClient } from './db.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { createAdminService } from './modules/admin/admin.service.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { createNotesRepository } from './modules/notes/notes.repository.js';
import { createNotesService } from './modules/notes/notes.service.js';
import { notesRoutes } from './modules/notes/notes.routes.js';
import { createProfileRepository } from './modules/profile/profile.repository.js';
import { profileRoutes } from './modules/profile/profile.routes.js';
import { createProfileService } from './modules/profile/profile.service.js';

export async function buildApp({
  prisma,
  config,
  logger = true,
}: {
  prisma: PrismaClient;
  config: Config;
  logger?: boolean;
}) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();

  // Zod schemas validate requests, serialize responses and generate the OpenAPI spec.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const auth = createAuth(prisma, config);
  const guards = createAuthGuards(auth);

  app.decorate('authenticate', guards.authenticate);
  app.decorate('authorize', guards.authorize);
  app.decorate('requireRole', guards.requireRole);

  await app.register(swagger, {
    openapi: {
      info: { title: '{{PROJECT_TITLE}}', version: '0.1.0' },
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Each module is built from plain functions: repository -> service -> routes.
  const notesService = createNotesService(createNotesRepository(prisma));
  const profileService = createProfileService(createProfileRepository(prisma));
  const adminService = createAdminService(auth);

  await app.register(healthRoutes);
  await app.register(authRoutes, { auth, config });
  await app.register(adminRoutes, { service: adminService });
  await app.register(profileRoutes, { auth, service: profileService });
  await app.register(notesRoutes, { service: notesService, auth });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
