import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import type { Config } from './config.js';
import { createPrisma } from './db.js';

// Writes the OpenAPI spec to packages/api-client/openapi.json.
// No database or port is needed: the Prisma client never connects here.
const config: Config = {
  PORT: 3000,
  DATABASE_URL: 'postgres://unused@localhost:5432/unused',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me-0123456789',
  BETTER_AUTH_URL: 'http://localhost:3000',
  TRUSTED_ORIGINS: ['http://localhost:5173'],
  AUTH_EMAIL_PASSWORD_ENABLED: true,
};

const app = await buildApp({
  prisma: createPrisma(config.DATABASE_URL),
  config,
  logger: false,
});
await app.ready();

const out = fileURLToPath(
  new URL('../../../packages/api-client/openapi.json', import.meta.url),
);
writeFileSync(out, JSON.stringify(app.swagger(), null, 2));
await app.close();
console.log(`OpenAPI spec written to ${out}`);
