import { z } from 'zod';

const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 4096, {
    message: 'metadata must be at most 4096 characters when serialized',
  });

const globalRoleSchema = z.enum(['user', 'moderator', 'admin', 'superadmin']);

export const profileSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    locale: z.string(),
    timezone: z.string(),
    metadata: metadataSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .describe('User profile');

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    image: z.url().max(2048).nullable().optional(),
    locale: z.string().trim().min(2).max(16).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    metadata: metadataSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
  .describe('Update profile input');

export const meSchema = z
  .object({
    user: z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.email(),
      emailVerified: z.boolean(),
      image: z.string().nullable(),
      role: z.string().nullable(),
    }),
    profile: profileSchema,
    roles: z.array(globalRoleSchema),
    permissions: z.object({
      canManageUsers: z.boolean(),
      canManageNotes: z.boolean(),
      canManageSystem: z.boolean(),
    }),
    avatarUrl: z.url().nullable(),
  })
  .describe('Current user');

export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Me = z.infer<typeof meSchema>;
export type GlobalRole = z.infer<typeof globalRoleSchema>;
