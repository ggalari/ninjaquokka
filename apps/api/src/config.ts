import { z } from 'zod';

const CODESPACE_API_PORT = 3000;
const CODESPACE_WEB_PORT = 5173;

function isLocalhostUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

function codespaceUrl(name: string, domain: string, port: number): string {
  return `https://${name}-${port}.${domain}`;
}

function addOrigin(origins: string[], origin: string | undefined): void {
  if (origin && !origins.includes(origin)) {
    origins.push(origin);
  }
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
    BETTER_AUTH_URL: z.url(),
    TRUSTED_ORIGINS: z.string().default('http://localhost:5173'),
    // Injected by GitHub Codespaces; absent during local development.
    CODESPACE_NAME: z.string().optional(),
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: z.string().optional(),
    AUTH_EMAIL_PASSWORD_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    AUTH_SSO_PROVIDER_ID: z.string().min(1).optional(),
    AUTH_SSO_DISCOVERY_URL: z.url().optional(),
    AUTH_SSO_CLIENT_ID: z.string().min(1).optional(),
    AUTH_SSO_CLIENT_SECRET: z.string().min(1).optional(),
    AUTH_SSO_SCOPES: z.string().min(1).optional(),
    AUTH_SSO_LABEL: z.string().min(1).optional(),
  })
  .transform((env, ctx) => {
    let hasErrors = false;

    const ssoValues = [
      env.AUTH_SSO_PROVIDER_ID,
      env.AUTH_SSO_DISCOVERY_URL,
      env.AUTH_SSO_CLIENT_ID,
      env.AUTH_SSO_CLIENT_SECRET,
      env.AUTH_SSO_SCOPES,
      env.AUTH_SSO_LABEL,
    ].filter((value) => value !== undefined);

    const ssoRequested = ssoValues.length > 0;

    if (ssoRequested) {
      for (const [key, value] of [
        ['AUTH_SSO_PROVIDER_ID', env.AUTH_SSO_PROVIDER_ID],
        ['AUTH_SSO_DISCOVERY_URL', env.AUTH_SSO_DISCOVERY_URL],
        ['AUTH_SSO_CLIENT_ID', env.AUTH_SSO_CLIENT_ID],
      ] as const) {
        if (!value) {
          hasErrors = true;
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when any AUTH_SSO_* variable is set`,
          });
        }
      }
    }

    const origins = env.TRUSTED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const codespaceName = env.CODESPACE_NAME?.trim();
    const codespaceDomain =
      env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN?.trim();
    const codespace =
      codespaceName && codespaceDomain
        ? {
            api: codespaceUrl(
              codespaceName,
              codespaceDomain,
              CODESPACE_API_PORT,
            ),
            web: codespaceUrl(
              codespaceName,
              codespaceDomain,
              CODESPACE_WEB_PORT,
            ),
          }
        : undefined;

    if (codespace) {
      // The browser reaches the web app through the forwarded 5173 URL and the
      // API through Vite's proxy, so the forwarded web origin must be trusted.
      addOrigin(origins, codespace.web);
      addOrigin(origins, codespace.api);
    }

    // Keep an explicitly configured public URL (for example a tunnel). Only
    // replace the localhost default with the Codespaces forwarded API URL.
    const betterAuthUrl =
      codespace && isLocalhostUrl(env.BETTER_AUTH_URL)
        ? codespace.api
        : env.BETTER_AUTH_URL;

    if (origins.length === 0) {
      hasErrors = true;
      ctx.addIssue({
        code: 'custom',
        path: ['TRUSTED_ORIGINS'],
        message: 'TRUSTED_ORIGINS must contain at least one URL',
      });
    }

    for (const origin of origins) {
      if (!z.url().safeParse(origin).success) {
        hasErrors = true;
        ctx.addIssue({
          code: 'custom',
          path: ['TRUSTED_ORIGINS'],
          message: `Invalid trusted origin: ${origin}`,
        });
      }
    }

    if (hasErrors) {
      return z.NEVER;
    }

    const sso =
      ssoRequested &&
      env.AUTH_SSO_PROVIDER_ID &&
      env.AUTH_SSO_DISCOVERY_URL &&
      env.AUTH_SSO_CLIENT_ID
        ? {
            providerId: env.AUTH_SSO_PROVIDER_ID,
            discoveryUrl: env.AUTH_SSO_DISCOVERY_URL,
            clientId: env.AUTH_SSO_CLIENT_ID,
            clientSecret: env.AUTH_SSO_CLIENT_SECRET,
            scopes: (env.AUTH_SSO_SCOPES ?? 'openid,profile,email')
              .split(',')
              .map((scope) => scope.trim())
              .filter(Boolean),
            label: env.AUTH_SSO_LABEL ?? env.AUTH_SSO_PROVIDER_ID,
          }
        : undefined;

    if (sso) {
      const idpOrigin = new URL(sso.discoveryUrl).origin;
      if (!origins.includes(idpOrigin)) {
        origins.push(idpOrigin);
      }
    }

    return {
      PORT: env.PORT,
      DATABASE_URL: env.DATABASE_URL,
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: betterAuthUrl,
      TRUSTED_ORIGINS: origins,
      AUTH_EMAIL_PASSWORD_ENABLED: env.AUTH_EMAIL_PASSWORD_ENABLED,
      sso,
    };
  });

export interface SsoConfig {
  providerId: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  label: string;
}

export interface Config {
  PORT: number;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TRUSTED_ORIGINS: string[];
  AUTH_EMAIL_PASSWORD_ENABLED: boolean;
  sso?: SsoConfig;
}

/** Validates environment variables once at startup and fails fast with a readable error. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
    process.exit(1);
  }
  return parsed.data;
}
