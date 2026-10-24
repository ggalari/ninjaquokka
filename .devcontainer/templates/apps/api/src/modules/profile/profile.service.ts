import { createHash } from 'node:crypto';
import { parseRoles } from '../../auth/permissions.js';
import type { Profile, Me, UpdateProfile } from './profile.schemas.js';
import type { ProfileRepository, ProfileRow } from './profile.repository.js';

type AvatarUser = {
  email: string;
  image: string | null;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
};

const toDto = (row: ProfileRow): Profile => ({
  id: row.id,
  userId: row.userId,
  displayName: row.displayName,
  bio: row.bio,
  locale: row.locale,
  timezone: row.timezone,
  metadata: (row.metadata ?? {}) as Record<string, unknown>,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export function resolveAvatarUrl(user: AvatarUser): string | null {
  if (user.image) return user.image;

  const email = user.email.trim().toLowerCase();
  if (!email) return null;

  const hash = createHash('md5').update(email).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}

function toMe(
  user: SessionUser,
  profile: Profile,
  imageOverride?: string | null,
): Me {
  const roles = parseRoles(user.role);
  const image =
    imageOverride !== undefined ? imageOverride : (user.image ?? null);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image,
      role: user.role ?? null,
    },
    profile,
    roles,
    permissions: {
      canManageUsers: roles.includes('admin') || roles.includes('superadmin'),
      canManageNotes:
        roles.includes('moderator') ||
        roles.includes('admin') ||
        roles.includes('superadmin'),
      canManageSystem: roles.includes('superadmin'),
    },
    avatarUrl: resolveAvatarUrl({ email: user.email, image }),
  };
}

export function createProfileService(repo: ProfileRepository) {
  return {
    getOrCreate: async (userId: string) => {
      const existing = await repo.findByUserId(userId);
      if (existing) return toDto(existing);

      const user = await repo.findUserName(userId);
      await repo.createIfMissing(userId, user.name);

      const row = await repo.findByUserId(userId);
      if (!row) throw new Error('Profile was not created');

      return toDto(row);
    },

    update: async (userId: string, input: UpdateProfile) =>
      toDto(await repo.upsert(userId, input)),

    toMe,
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
