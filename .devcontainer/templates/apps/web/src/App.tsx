import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fetchMe } from './api';
import { authClient } from './auth-client';
import { AdminPanel } from './AdminPanel';
import { Avatar } from './Avatar';
import { ProfilePanel } from './ProfilePanel';

type AuthMode = 'sign-in' | 'sign-up';

export default function App() {
  const session = authClient.useSession();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const user = session.data?.user;

  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/health');
      if (error) throw error;
      return data;
    },
  });

  const authConfig = useQuery({
    queryKey: ['auth-config'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/auth/config');
      if (error) throw error;
      return data;
    },
  });

  const me = useQuery({
    queryKey: ['me', user?.id],
    queryFn: fetchMe,
    enabled: Boolean(user),
  });

  const sso = authConfig.data?.sso;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const result =
      mode === 'sign-up'
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message ?? 'Authentication failed');
      return;
    }

    setPassword('');
    await session.refetch();
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setMessage(null);

    const { error } = await authClient.signOut();
    setIsSubmitting(false);

    if (error) {
      setMessage(error.message ?? 'Sign out failed');
      return;
    }

    await session.refetch();
  }

  async function handleSso() {
    const providerId = authConfig.data?.sso.providerId;
    if (!providerId) return;

    setMessage(null);
    const { error } = await authClient.signIn.social({
      provider: providerId,
      callbackURL: window.location.origin,
    });

    if (error) {
      setMessage(error.message ?? 'SSO sign-in failed');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-100 sm:p-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-4">
          <img
            src="/logo.svg"
            alt="{{PROJECT_TITLE}} logo"
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          <h1 className="text-xl font-semibold sm:text-2xl">{{PROJECT_TITLE}}</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to manage your account and profile.
        </p>
        <p className="mt-4 font-mono text-xs text-slate-500">
          API status:{' '}
          <span
            className={health.isError ? 'text-red-400' : 'text-emerald-400'}
          >
            {health.isPending
              ? 'checking...'
              : health.isError
                ? 'unreachable'
                : health.data?.status}
          </span>
        </p>

        <div className="mt-6">
          {session.isPending ? (
            <p className="text-sm text-slate-400">Checking session...</p>
          ) : user ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={me.data?.avatarUrl ?? null}
                    name={me.data?.profile.displayName ?? user.name}
                  />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Signed in
                    </p>
                    <p className="mt-1 font-medium">{user.name}</p>
                    <p className="text-sm text-slate-400">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSubmitting}
                  className="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Signing out...' : 'Sign out'}
                </button>
              </div>

              {me.data ? (
                <>
                  <ProfilePanel me={me.data} />
                  {me.data.permissions.canManageUsers ? (
                    <AdminPanel me={me.data} />
                  ) : null}
                </>
              ) : me.isPending ? (
                <p className="text-sm text-slate-400">Loading profile...</p>
              ) : me.isError ? (
                <p className="text-sm text-red-400">
                  Could not load your profile.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in');
                    setMessage(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    mode === 'sign-in'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up');
                    setMessage(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    mode === 'sign-up'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign up
                </button>
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                {mode === 'sign-up' ? (
                  <label className="block text-sm text-slate-300">
                    Name
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      autoComplete="name"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                    />
                  </label>
                ) : null}

                <label className="block text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === 'sign-up' ? 8 : undefined}
                    autoComplete={
                      mode === 'sign-up' ? 'new-password' : 'current-password'
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? 'Working...'
                    : mode === 'sign-up'
                      ? 'Create account'
                      : 'Sign in'}
                </button>
              </form>

              {sso?.enabled && sso.providerId ? (
                <div className="mt-5">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
                    <span className="h-px flex-1 bg-slate-800" />
                    or
                    <span className="h-px flex-1 bg-slate-800" />
                  </div>
                  <button
                    type="button"
                    onClick={handleSso}
                    className="mt-3 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    Continue with {sso.label ?? sso.providerId}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {message ? (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {message}
            </p>
          ) : null}
          {session.error ? (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {session.error.message}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
