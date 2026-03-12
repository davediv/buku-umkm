import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { getRequestEvent } from '$app/server';
import * as schema from './schema';

export type SQLiteDb = DrizzleD1Database<typeof schema>;

export function getDb(): SQLiteDb {
	const event = getRequestEvent();
	if (!event?.platform?.env?.DB) {
		throw new Error('D1 database binding not found');
	}
	const d1 = event.platform.env.DB;
	return drizzle(d1, { schema });
}
