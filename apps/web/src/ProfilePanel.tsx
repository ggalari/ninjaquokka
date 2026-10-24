import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from './api';
import { Avatar } from './Avatar';

type ProfileForm = {
  displayName: string;
  bio: string;
  locale: string;
  timezone: string;
  image: string;
};

const toForm = (me: Me): ProfileForm => ({
  displayName: me.profile.displayName ?? '',
  bio: me.profile.bio ?? '',
  locale: me.profile.locale,
  timezone: me.profile.timezone,
  image: me.user.image ?? '',
});

export function ProfilePanel({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(() => toForm(me));

  useEffect(() => {
    setForm(toForm(me));
  }, [me]);

  const updateProfile = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const { data, error } = await api.PATCH('/api/me/profile', {
        body: {
          displayName: values.displayName.trim() || null,
          bio: values.bio.trim() || null,
          image: values.image.trim() || null,
          locale: values.locale.trim(),
          timezone: values.timezone.trim(),
        },
      });

      if (error) {
        throw new Error(error.message ?? 'Could not save profile');
      }
      if (!data) {
        throw new Error('No profile returned');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Me>(['me', me.user.id], data);
    },
  });

  const previewUrl = form.image.trim() || me.avatarUrl;
  const previewName = form.displayName.trim() || me.user.name;

  function updateField<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate(form);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center gap-3">
        <Avatar
          src={previewUrl}
          name={previewName}
          className="h-16 w-16 text-lg"
        />
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Profile
          </p>
          <p className="mt-1 font-medium">{previewName}</p>
          <p className="text-xs text-slate-500">Avatar preview</p>
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm text-slate-300">
          Display name
          <input
            type="text"
            value={form.displayName}
            onChange={(event) => updateField('displayName', event.target.value)}
            maxLength={80}
            autoComplete="nickname"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Bio
          <textarea
            value={form.bio}
            onChange={(event) => updateField('bio', event.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Locale
            <input
              type="text"
              value={form.locale}
              onChange={(event) => updateField('locale', event.target.value)}
              required
              minLength={2}
              maxLength={16}
              placeholder="en"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Timezone
            <input
              type="text"
              value={form.timezone}
              onChange={(event) => updateField('timezone', event.target.value)}
              required
              maxLength={64}
              placeholder="UTC"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            />
          </label>
        </div>

        <label className="block text-sm text-slate-300">
          Avatar image URL
          <input
            type="url"
            value={form.image}
            onChange={(event) => updateField('image', event.target.value)}
            maxLength={2048}
            placeholder="https://example.com/avatar.png"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        <p className="text-xs text-slate-500">
          Leave blank to use the server-provided Gravatar fallback.
        </p>

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateProfile.isPending ? 'Saving...' : 'Save profile'}
        </button>

        {updateProfile.isError ? (
          <p className="text-sm text-red-400" role="alert">
            {updateProfile.error.message}
          </p>
        ) : null}
        {updateProfile.isSuccess ? (
          <p className="text-sm text-emerald-400">Saved.</p>
        ) : null}
      </form>
    </div>
  );
}
