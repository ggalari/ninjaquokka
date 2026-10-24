import { describe, expect, it } from 'vitest';
import { canChangeUserRole, canModerateUser } from '../src/auth/permissions.js';

const actor = { actorId: 'actor', actorRoles: 'admin' };

describe('role assignment policy', () => {
  it('allows an admin to assign an assignable role', () => {
    expect(
      canChangeUserRole({
        ...actor,
        targetId: 'target',
        targetRoles: 'user',
        nextRole: 'moderator',
      }),
    ).toBe(true);
  });

  it('rejects superadmin assignment', () => {
    expect(
      canChangeUserRole({
        ...actor,
        targetId: 'target',
        targetRoles: 'user',
        nextRole: 'superadmin',
      }),
    ).toBe(false);
  });

  it('rejects changing a superadmin', () => {
    expect(
      canChangeUserRole({
        ...actor,
        targetId: 'target',
        targetRoles: 'superadmin',
        nextRole: 'user',
      }),
    ).toBe(false);
  });

  it('rejects self changes', () => {
    expect(
      canChangeUserRole({
        actorId: 'actor',
        actorRoles: 'admin',
        targetId: 'actor',
        targetRoles: 'admin',
        nextRole: 'user',
      }),
    ).toBe(false);
  });

  it('rejects callers without an admin role', () => {
    expect(
      canChangeUserRole({
        actorId: 'actor',
        actorRoles: 'moderator',
        targetId: 'target',
        targetRoles: 'user',
        nextRole: 'admin',
      }),
    ).toBe(false);
  });
});

describe('user moderation policy', () => {
  it('allows an admin to moderate a normal user', () => {
    expect(
      canModerateUser({
        actorId: 'actor',
        actorRoles: 'admin',
        targetId: 'target',
        targetRoles: 'user',
      }),
    ).toBe(true);
  });

  it('rejects self moderation', () => {
    expect(
      canModerateUser({
        actorId: 'actor',
        actorRoles: 'admin',
        targetId: 'actor',
        targetRoles: 'admin',
      }),
    ).toBe(false);
  });

  it('rejects moderating a superadmin', () => {
    expect(
      canModerateUser({
        actorId: 'actor',
        actorRoles: 'admin',
        targetId: 'target',
        targetRoles: 'superadmin',
      }),
    ).toBe(false);
  });
});
