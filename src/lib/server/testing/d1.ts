import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import type { SQLiteDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

const MIGRATIONS_DIR = 'drizzle';

/**
 * An in-memory local D1 (the same workerd engine as production) with every
 * migration applied. Unlike sql.js it enforces D1's own rules: no BEGIN/SAVEPOINT,
 * at most 100 bound parameters per statement, and atomic batches.
 */
export async function createTestD1(): Promise<{
	db: SQLiteDb;
	d1: D1Database;
	createUser: (id?: string) => Promise<string>;
	dispose: () => Promise<void>;
}> {
	const proxy = await getPlatformProxy<Env>({ configPath: 'wrangler.jsonc', persist: false });
	const d1 = proxy.env.DB;

	const files = readdirSync(MIGRATIONS_DIR)
		.filter((file) => file.endsWith('.sql'))
		.sort();
	for (const file of files) {
		const statements = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
			.split('--> statement-breakpoint')
			.map((statement) => statement.trim())
			.filter(Boolean);
		for (const statement of statements) await d1.prepare(statement).run();
	}

	const db = drizzle(d1, { schema });
	let userCount = 0;
	return {
		db,
		d1,
		async createUser(id = `user-${++userCount}`) {
			await db.insert(schema.user).values({ id, name: id, email: `${id}@example.test` });
			return id;
		},
		dispose: () => proxy.dispose()
	};
}
