import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createProfileService,
  resolveAvatarUrl,
} from '../src/modules/profile/profile.service.js';
import type {
  ProfileRepository,
  ProfileRow,
} from '../src/modules/profile/profile.repository.js';

const row: ProfileRow = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  displayName: 'Ada',
  bio: null,
  locale: 'en',
  timezone: 'UTC',
  metadata: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeRepo(initial: ProfileRow | null) {
  let current = initial;

  return {
    findByUserId: async () => current,
    findUserName: async () => ({ name: 'Ada' }),
    createIfMissing: async () => {
      current = row;
    },
    upsert: async () => row,
  } as ProfileRepository;
}

describe('profile service', () => {
  it('returns an existing profile', async () => {
    const service = createProfileService(makeRepo(row));

    await expect(service.getOrCreate(row.userId)).resolves.toMatchObject({
      id: row.id,
      displayName: 'Ada',
    });
  });

  it('creates a missing profile from the user name', async () => {
    const service = createProfileService(makeRepo(null));

    await expect(service.getOrCreate(row.userId)).resolves.toMatchObject({
      userId: row.userId,
      displayName: 'Ada',
    });
  });

  it('maps roles, permissions and the avatar in the service', async () => {
    const service = createProfileService(makeRepo(row));
    const profile = await service.getOrCreate(row.userId);
    const me = service.toMe(
      {
        id: row.userId,
        name: 'Ada',
        email: 'ada@example.com',
        emailVerified: true,
        image: 'https://example.com/avatar.png',
        role: 'admin',
      },
      profile,
    );

    expect(me.roles).toEqual(['admin']);
    expect(me.permissions).toEqual({
      canManageUsers: true,
      canManageNotes: true,
      canManageSystem: false,
    });
    expect(me.avatarUrl).toBe('https://example.com/avatar.png');
  });
});

describe('avatar resolution', () => {
  it('prefers the stored image', () => {
    expect(
      resolveAvatarUrl({ email: 'ada@example.com', image: 'https://x.test/a' }),
    ).toBe('https://x.test/a');
  });

  it('falls back to a normalised Gravatar hash', () => {
    const hash = createHash('md5').update('ada@example.com').digest('hex');

    expect(resolveAvatarUrl({ email: ' Ada@Example.com ', image: null })).toBe(
      `https://www.gravatar.com/avatar/${hash}?d=identicon`,
    );
  });
});
