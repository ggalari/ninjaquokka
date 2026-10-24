import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Auth } from '../../auth/auth.js';
import { errorSchema } from '../../shared/schemas.js';
import {
  createNoteSchema,
  listNotesQuerySchema,
  noteSchema,
  updateNoteSchema,
} from './notes.schemas.js';
import type { NotesService } from './notes.service.js';

export const notesRoutes: FastifyPluginAsyncZod<{
  service: NotesService;
  auth: Auth;
}> = async (app, { service, auth }) => {
  const isManager = async (userId: string) => {
    try {
      const result = await auth.api.userHasPermission({
        body: {
          userId,
          permissions: { note: ['manage'] },
        },
      });
      return result.success;
    } catch {
      return false;
    }
  };

  app.get(
    '/api/notes',
    {
      preHandler: [app.authenticate, app.authorize('note', ['read'])],
      schema: {
        operationId: 'listNotes',
        tags: ['notes'],
        security: [{ cookieAuth: [] }],
        querystring: listNotesQuerySchema,
        response: {
          200: z.array(noteSchema).describe('List of notes'),
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
        },
      },
    },
    async (request, reply) => {
      const { user } = request.auth;
      const canManage = await isManager(user.id);

      if (request.query.scope === 'all' && !canManage) {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      return service.list(user.id, canManage && request.query.scope === 'all');
    },
  );

  app.get(
    '/api/notes/:id',
    {
      preHandler: [app.authenticate, app.authorize('note', ['read'])],
      schema: {
        operationId: 'getNote',
        tags: ['notes'],
        security: [{ cookieAuth: [] }],
        params: z.object({ id: z.uuid() }),
        response: {
          200: noteSchema,
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
          404: errorSchema.describe('Note not found'),
        },
      },
    },
    async (request, reply) => {
      const { user } = request.auth;
      const canManage = await isManager(user.id);
      const note = await service.get(request.params.id, user.id, canManage);

      return note ?? reply.code(404).send({ message: 'Note not found' });
    },
  );

  app.post(
    '/api/notes',
    {
      preHandler: [app.authenticate, app.authorize('note', ['create'])],
      schema: {
        operationId: 'createNote',
        tags: ['notes'],
        security: [{ cookieAuth: [] }],
        body: createNoteSchema,
        response: {
          201: noteSchema,
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
        },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await service.create(request.auth.user.id, request.body)),
  );

  app.patch(
    '/api/notes/:id',
    {
      preHandler: [app.authenticate, app.authorize('note', ['update'])],
      schema: {
        operationId: 'updateNote',
        tags: ['notes'],
        security: [{ cookieAuth: [] }],
        params: z.object({ id: z.uuid() }),
        body: updateNoteSchema,
        response: {
          200: noteSchema,
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
          404: errorSchema.describe('Note not found'),
        },
      },
    },
    async (request, reply) => {
      const { user } = request.auth;
      const canManage = await isManager(user.id);
      const note = await service.update(
        request.params.id,
        user.id,
        canManage,
        request.body,
      );

      return note ?? reply.code(404).send({ message: 'Note not found' });
    },
  );

  app.delete(
    '/api/notes/:id',
    {
      preHandler: [app.authenticate, app.authorize('note', ['delete'])],
      schema: {
        operationId: 'deleteNote',
        tags: ['notes'],
        security: [{ cookieAuth: [] }],
        params: z.object({ id: z.uuid() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: errorSchema.describe('Unauthorized'),
          403: errorSchema.describe('Forbidden'),
          404: errorSchema.describe('Note not found'),
        },
      },
    },
    async (request, reply) => {
      const { user } = request.auth;
      const canManage = await isManager(user.id);
      const removed = await service.remove(
        request.params.id,
        user.id,
        canManage,
      );

      if (!removed) {
        return reply.code(404).send({ message: 'Note not found' });
      }

      return { success: true as const };
    },
  );
};
