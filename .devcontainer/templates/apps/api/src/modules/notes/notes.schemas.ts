import { z } from 'zod';

export const noteSchema = z
  .object({
    id: z.uuid(),
    body: z.string(),
    ownerId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .describe('A note');

export const createNoteSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .describe('Create note input');

export const updateNoteSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .describe('Update note input');

export const listNotesQuerySchema = z
  .object({
    scope: z.enum(['mine', 'all']).default('mine'),
  })
  .describe('Note list scope');

export type Note = z.infer<typeof noteSchema>;
export type CreateNote = z.infer<typeof createNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type NoteScope = z.infer<typeof listNotesQuerySchema>;
