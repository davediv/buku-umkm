import { drizzle } from 'drizzle-orm/d1';
import { getRequestEvent } from '$app/server';
import * as schema from './schema';

export function getDb() {
	const event = getRequestEvent();
	const d1 = event!.platform?.env.DB;
	if (!d1) throw new Error('D1 database binding not found');
	return drizzle(d1, { schema });
}
