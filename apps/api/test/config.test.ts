import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const baseEnv = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/app',
  BETTER_AUTH_SECRET: 'dev-better-auth-secret-change-me',
  BETTER_AUTH_URL: 'http://localhost:3000',
  TRUSTED_ORIGINS: 'http://localhost:5173',
};

const codespaceEnv = {
  ...baseEnv,
  CODESPACE_NAME: 'octocat-literate-space-parakeet-mld5',
  GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
};

describe('loadConfig', () => {
  it('keeps localhost defaults outside Codespaces', () => {
    const config = loadConfig(baseEnv);

    expect(config.BETTER_AUTH_URL).toBe('http://localhost:3000');
    expect(config.TRUSTED_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('derives the forwarded origins from Codespaces environment variables', () => {
    const config = loadConfig(codespaceEnv);

    expect(config.BETTER_AUTH_URL).toBe(
      'https://octocat-literate-space-parakeet-mld5-3000.app.github.dev',
    );
    expect(config.TRUSTED_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://octocat-literate-space-parakeet-mld5-5173.app.github.dev',
      'https://octocat-literate-space-parakeet-mld5-3000.app.github.dev',
    ]);
  });

  it('does not duplicate origins already listed explicitly', () => {
    const config = loadConfig({
      ...codespaceEnv,
      TRUSTED_ORIGINS:
        'http://localhost:5173,https://octocat-literate-space-parakeet-mld5-5173.app.github.dev',
    });

    expect(
      config.TRUSTED_ORIGINS.filter(
        (origin) =>
          origin ===
          'https://octocat-literate-space-parakeet-mld5-5173.app.github.dev',
      ),
    ).toHaveLength(1);
  });

  it('keeps an explicitly configured public API URL in Codespaces', () => {
    const config = loadConfig({
      ...codespaceEnv,
      BETTER_AUTH_URL: 'https://api.example.com',
    });

    expect(config.BETTER_AUTH_URL).toBe('https://api.example.com');
    expect(config.TRUSTED_ORIGINS).toContain(
      'https://octocat-literate-space-parakeet-mld5-5173.app.github.dev',
    );
  });

  it('ignores an incomplete Codespaces configuration', () => {
    const config = loadConfig({
      ...baseEnv,
      CODESPACE_NAME: 'octocat-literate-space-parakeet-mld5',
    });

    expect(config.BETTER_AUTH_URL).toBe('http://localhost:3000');
    expect(config.TRUSTED_ORIGINS).toEqual(['http://localhost:5173']);
  });
});
