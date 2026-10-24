import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from './auth.js';
import {
  parseRoles,
  type Action,
  type Resource,
  type RoleName,
} from './permissions.js';

export type AuthContext = NonNullable<
  Awaited<ReturnType<Auth['api']['getSession']>>
>;

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
  interface FastifyInstance {
    authenticate: AuthGuards['authenticate'];
    authorize: AuthGuards['authorize'];
    requireRole: AuthGuards['requireRole'];
  }
}

export function createAuthGuards(auth: Auth) {
  const getSession = async (
    request: FastifyRequest,
  ): Promise<AuthContext | null> => {
    return auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
  };

  const resolveSession = async (
    request: FastifyRequest,
  ): Promise<AuthContext | null> => {
    const cached: AuthContext | undefined = request.auth;
    if (cached) return cached;

    const session = await getSession(request);
    if (session) request.auth = session;
    return session;
  };

  const authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const session = await resolveSession(request);
    if (!session) {
      reply.code(401).send({ message: 'Unauthorized' });
    }
  };

  const authorize =
    <R extends Resource>(resource: R, actions: readonly Action<R>[]) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const session = await resolveSession(request);
      if (!session) {
        reply.code(401).send({ message: 'Unauthorized' });
        return;
      }

      try {
        const result = await auth.api.userHasPermission({
          body: {
            userId: session.user.id,
            permissions: { [resource]: [...actions] },
          },
        });

        if (!result.success) {
          reply.code(403).send({ message: 'Forbidden' });
        }
      } catch (error) {
        request.log.error({ err: error }, 'Permission check failed');
        reply.code(403).send({ message: 'Forbidden' });
      }
    };

  const requireRole =
    (...roles: RoleName[]) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const session = await resolveSession(request);
      if (!session) {
        reply.code(401).send({ message: 'Unauthorized' });
        return;
      }

      const userRoles = parseRoles(session.user.role);
      if (!roles.some((role) => userRoles.includes(role))) {
        reply.code(403).send({ message: 'Forbidden' });
      }
    };

  return { getSession, authenticate, authorize, requireRole };
}

export type AuthGuards = ReturnType<typeof createAuthGuards>;
