import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from './api';
import { authClient } from './auth-client';
import { Avatar } from './Avatar';

type AssignableRole = 'user' | 'moderator' | 'admin';

export function AdminPanel({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const users = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const query = search.trim()
        ? {
            limit: 50,
            offset: 0,
            searchValue: search.trim(),
            searchField: 'email' as const,
            searchOperator: 'contains' as const,
          }
        : { limit: 50, offset: 0 };

      const { data, error } = await authClient.admin.listUsers({ query });

      if (error) throw new Error(error.message ?? 'Could not load users');
      if (!data) throw new Error('No users returned');

      return data;
    },
  });

  const setRole = useMutation({
    mutationFn: async (input: { userId: string; role: AssignableRole }) => {
      const { data, error } = await api.POST('/api/admin/users/{id}/role', {
        params: { path: { id: input.userId } },
        body: { role: input.role },
      });

      if (error) throw new Error(error.message ?? 'Could not change role');
      if (!data) throw new Error('No user returned');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const setBan = useMutation({
    mutationFn: async (input: { userId: string; banned: boolean }) => {
      const { error } = await api.POST('/api/admin/users/{id}/ban', {
        params: { path: { id: input.userId } },
        body: { banned: input.banned },
      });

      if (error) throw new Error(error.message ?? 'Could not update ban');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const actionError = setRole.error ?? setBan.error;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Admin
          </p>
          <h2 className="mt-1 font-medium">Users</h2>
        </div>
        {users.data ? (
          <span className="text-xs text-slate-500">
            {users.data.total} total
          </span>
        ) : null}
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by email"
        aria-label="Search users by email"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
      />

      {users.isPending ? (
        <p className="mt-3 text-sm text-slate-400">Loading users...</p>
      ) : users.isError ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {users.error.message}
        </p>
      ) : users.data?.users.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No users found.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800">
          {users.data?.users.map((user) => {
            const isSelf = user.id === me.user.id;
            const isSuperadmin = user.role === 'superadmin';
            const role = user.role ?? 'user';

            return (
              <li key={user.id} className="py-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={user.image ?? null}
                    name={user.name}
                    className="h-10 w-10 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.name}
                      {isSelf ? ' (you)' : ''}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <span
                    title={user.banReason ?? undefined}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.banned
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {user.banned ? 'Banned' : 'Active'}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isSuperadmin ? (
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                      superadmin (locked)
                    </span>
                  ) : (
                    <select
                      value={role}
                      onChange={(event) =>
                        setRole.mutate({
                          userId: user.id,
                          role: event.target.value as AssignableRole,
                        })
                      }
                      disabled={isSelf || setRole.isPending}
                      aria-label={`Role for ${user.name}`}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {!['user', 'moderator', 'admin'].includes(role) ? (
                        <option value={role}>{role}</option>
                      ) : null}
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setBan.mutate({
                        userId: user.id,
                        banned: !user.banned,
                      })
                    }
                    disabled={isSelf || isSuperadmin || setBan.isPending}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {user.banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {actionError ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {actionError.message}
        </p>
      ) : null}
    </div>
  );
}
