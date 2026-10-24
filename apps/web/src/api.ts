import { createApiClient } from '@ninjaquokka/api-client';

export const api = createApiClient();

export async function fetchMe() {
  const { data, error } = await api.GET('/api/me');

  if (error) throw error;
  if (!data) throw new Error('No profile returned');

  return data;
}

export type Me = Awaited<ReturnType<typeof fetchMe>>;
