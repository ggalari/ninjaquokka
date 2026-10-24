import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { admin, genericOAuth, openAPI } from 'better-auth/plugins';
import type { Config } from '../config.js';
import type { PrismaClient } from '../db.js';
import { ac, roles } from './permissions.js';

// Raw admin mutations would bypass the policy in the domain routes. Keep the
// read-only admin endpoints; expose every mutation through /api/admin instead.
export const DISABLED_ADMIN_PATHS = [
  '/admin/set-role',
  '/admin/create-user',
  '/admin/update-user',
  '/admin/remove-user',
  '/admin/set-user-password',
  '/admin/ban-user',
  '/admin/unban-user',
  '/admin/impersonate-user',
  '/admin/stop-impersonating',
  '/admin/revoke-user-session',
  '/admin/revoke-user-sessions',
] as const;

export function createAuth(prisma: PrismaClient, config: Config) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: config.TRUSTED_ORIGINS,
    emailAndPassword: { enabled: config.AUTH_EMAIL_PASSWORD_ENABLED },
    disabledPaths: [...DISABLED_ADMIN_PATHS],
    advanced: {
      database: {
        joins: true,
        generateId: 'uuid',
      },
    },
    plugins: [
      admin({ ac, roles, defaultRole: 'user' }),
      openAPI(),
      ...(config.sso
        ? [
            genericOAuth({
              config: [
                {
                  providerId: config.sso.providerId,
                  discoveryUrl: config.sso.discoveryUrl,
                  clientId: config.sso.clientId,
                  clientSecret: config.sso.clientSecret,
                  scopes: config.sso.scopes,
                },
              ],
            }),
          ]
        : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
