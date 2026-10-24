import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Set by the dev container (docker-compose.yml, from .devcontainer/.env).
    // The fallback matches the default DB_NAME there; adjust if you change it.
    url:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/app',
  },
});
