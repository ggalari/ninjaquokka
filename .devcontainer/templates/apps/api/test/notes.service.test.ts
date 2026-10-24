import { describe, expect, it } from 'vitest';
import { createNotesService } from '../src/modules/notes/notes.service.js';
import type { NotesRepository } from '../src/modules/notes/notes.repository.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

const note = {
  id: '33333333-3333-4333-8333-333333333333',
  body: 'private',
  ownerId,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeRepo() {
  return {
    list: async (requestedOwnerId?: string) =>
      requestedOwnerId && requestedOwnerId !== ownerId ? [] : [note],
    findById: async (id: string) => (id === note.id ? note : null),
    create: async (body: string, noteOwnerId: string) => ({
      ...note,
      id: '44444444-4444-4444-8444-444444444444',
      body,
      ownerId: noteOwnerId,
    }),
    update: async (id: string, body: string) => ({
      ...note,
      id,
      body,
    }),
    delete: async (id: string) => ({ ...note, id }),
  } as NotesRepository;
}

describe('notes ownership', () => {
  it('returns a note to its owner', async () => {
    const service = createNotesService(makeRepo());

    await expect(service.get(note.id, ownerId, false)).resolves.toMatchObject({
      body: 'private',
    });
  });

  it('hides another user’s note from a normal user', async () => {
    const service = createNotesService(makeRepo());

    await expect(service.get(note.id, otherId, false)).resolves.toBeNull();
    await expect(
      service.update(note.id, otherId, false, { body: 'changed' }),
    ).resolves.toBeNull();
    await expect(service.remove(note.id, otherId, false)).resolves.toBe(false);
  });

  it('lets a manager bypass ownership', async () => {
    const service = createNotesService(makeRepo());

    await expect(service.get(note.id, otherId, true)).resolves.toMatchObject({
      body: 'private',
    });
  });

  it('lists only the caller’s notes unless the caller manages all', async () => {
    const service = createNotesService(makeRepo());

    await expect(service.list(ownerId, false)).resolves.toHaveLength(1);
    await expect(service.list(otherId, false)).resolves.toHaveLength(0);
    await expect(service.list(otherId, true)).resolves.toHaveLength(1);
  });
});
