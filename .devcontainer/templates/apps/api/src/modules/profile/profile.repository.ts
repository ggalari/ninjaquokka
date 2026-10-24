import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaClient } from '../../db.js';
import type { UpdateProfile } from './profile.schemas.js';

export type ProfileRow = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  locale: string;
  timezone: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export function createProfileRepository(prisma: PrismaClient) {
  return {
    findByUserId: async (userId: string): Promise<ProfileRow | null> =>
      prisma.profile.findUnique({ where: { userId } }),

    findUserName: async (userId: string): Promise<{ name: string }> =>
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true },
      }),

    createIfMissing: async (userId: string, displayName: string) => {
      await prisma.profile.createMany({
        data: [{ userId, displayName }],
        skipDuplicates: true,
      });
    },

    upsert: async (
      userId: string,
      input: UpdateProfile,
    ): Promise<ProfileRow> => {
      const profileData = { ...input };
      delete profileData.image;

      const data = {
        ...profileData,
        metadata: profileData.metadata as Prisma.InputJsonValue | undefined,
      };

      return prisma.profile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
