import type { PrismaClient } from '../../db.js';

// Methods are async so their type is a plain Promise (not Prisma's special promise),
// which lets tests pass simple hand-written fakes to the service.
export function createNotesRepository(prisma: PrismaClient) {
  return {
    list: async (ownerId?: string) =>
      prisma.note.findMany({
        where: ownerId ? { ownerId } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
    findById: async (id: string) => prisma.note.findUnique({ where: { id } }),
    create: async (body: string, ownerId: string) =>
      prisma.note.create({ data: { body, ownerId } }),
    update: async (id: string, body: string) =>
      prisma.note.update({ where: { id }, data: { body } }),
    delete: async (id: string) => prisma.note.delete({ where: { id } }),
  };
}

export type NotesRepository = ReturnType<typeof createNotesRepository>;
