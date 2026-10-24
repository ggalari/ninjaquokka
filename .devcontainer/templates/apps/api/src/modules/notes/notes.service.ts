import type { CreateNote, Note, UpdateNote } from './notes.schemas.js';
import type { NotesRepository } from './notes.repository.js';

type NoteRow = {
  id: string;
  body: string;
  ownerId: string | null;
  createdAt: Date;
};

const toDto = (row: NoteRow): Note => ({
  id: row.id,
  body: row.body,
  ownerId: row.ownerId,
  createdAt: row.createdAt.toISOString(),
});

export function createNotesService(repo: NotesRepository) {
  return {
    list: async (ownerId: string, all: boolean) =>
      (await repo.list(all ? undefined : ownerId)).map(toDto),
    get: async (id: string, ownerId: string, canManage: boolean) => {
      const row = await repo.findById(id);
      if (!row) return null;
      if (!canManage && row.ownerId !== ownerId) return null;
      return toDto(row);
    },
    create: async (ownerId: string, input: CreateNote) =>
      toDto(await repo.create(input.body, ownerId)),
    update: async (
      id: string,
      ownerId: string,
      canManage: boolean,
      input: UpdateNote,
    ) => {
      const row = await repo.findById(id);
      if (!row) return null;
      if (!canManage && row.ownerId !== ownerId) return null;
      return toDto(await repo.update(id, input.body));
    },
    remove: async (id: string, ownerId: string, canManage: boolean) => {
      const row = await repo.findById(id);
      if (!row) return null;
      if (!canManage && row.ownerId !== ownerId) return false;
      await repo.delete(id);
      return true;
    },
  };
}

export type NotesService = ReturnType<typeof createNotesService>;
