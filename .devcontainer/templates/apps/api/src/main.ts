import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrisma } from './db.js';

const config = loadConfig();
const app = await buildApp({
  prisma: createPrisma(config.DATABASE_URL),
  config,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
