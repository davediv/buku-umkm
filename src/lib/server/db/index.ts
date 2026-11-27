import { env } from 'cloudflare:workers';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type SQLiteDb = DrizzleD1Database<typeof schema>;

export function getDb(): SQLiteDb {
	if (!env.DB) {
		throw new Error('D1 database binding not found');
	}
	return drizzle(env.DB, { schema });
}
