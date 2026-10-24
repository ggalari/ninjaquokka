import { loadConfig } from '../config.js';
import { createPrisma } from '../db.js';
import { createAuth } from './auth.js';

const config = loadConfig();

export const auth = createAuth(createPrisma(config.DATABASE_URL), config);
export default auth;
