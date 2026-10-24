import createClient from 'openapi-fetch';
import type { paths } from './schema';

export type { paths, components } from './schema';

/** Fully typed REST client. Paths, params and responses come from the API's OpenAPI spec. */
export const createApiClient = (baseUrl = '') =>
  createClient<paths>({ baseUrl, credentials: 'include' });
