import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import { category, transactionTemplate } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('$lib/server/db', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';
import { PUT } from './[id]/+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;
let db: SQLiteDb;

const locals = { user: { id: 'owner' }, session: { id: 'session-owner' } };

function post(body: unknown) {
	return POST({
		locals,
		request: new Request('https://buku.test/api/templates', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof POST>[0]);
}

function put(id: string, body: unknown) {
	return PUT({
		locals,
		params: { id },
		request: new Request(`https://buku.test/api/templates/${id}`, {
			method: 'PUT',
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof PUT>[0]);
}

beforeAll(async () => {
	harness = await createTestD1();
	db = harness.db;
	dbRef.current = db;
	await harness.createUser('owner');
	await harness.createUser('other');
	await db.insert(category).values([
		{ id: 'own-expense', userId: 'owner', code: '5901', name: 'Bahan', type: 'expense' },
		{ id: 'own-income', userId: 'owner', code: '4901', name: 'Jualan', type: 'income' },
		{ id: 'foreign-expense', userId: 'other', code: '5902', name: 'Rahasia', type: 'expense' }
	]);
	await db.insert(transactionTemplate).values({
		id: 'tmpl-1',
		userId: 'owner',
		name: 'Belanja',
		type: 'expense',
		categoryId: 'own-expense'
	});
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('template category ownership', () => {
	it("refuses to create a template on another user's category", async () => {
		const foreign = await post({ name: 'Bocor', type: 'expense', categoryId: 'foreign-expense' });
		const missing = await post({ name: 'Bocor', type: 'expense', categoryId: 'no-such-id' });

		expect(foreign.status).toBe(400);
		expect(missing.status).toBe(400);
		expect(await foreign.json()).toEqual(await missing.json());
		const rows = await db
			.select()
			.from(transactionTemplate)
			.where(eq(transactionTemplate.name, 'Bocor'));
		expect(rows).toHaveLength(0);
	});

	it('creates a template on an own category of the same type', async () => {
		const response = await post({ name: 'Bahan Baku', type: 'expense', categoryId: 'own-expense' });

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({ template: { categoryId: 'own-expense' } });
	});

	it("refuses to move a template onto another user's category", async () => {
		const response = await put('tmpl-1', { categoryId: 'foreign-expense' });

		expect(response.status).toBe(400);
		const [row] = await db
			.select()
			.from(transactionTemplate)
			.where(eq(transactionTemplate.id, 'tmpl-1'));
		expect(row.categoryId).toBe('own-expense');
	});

	it('refuses a type change that no longer matches the current category', async () => {
		const response = await put('tmpl-1', { type: 'income' });

		expect(response.status).toBe(400);
	});

	it('rejects an unknown type, an overlong name or a non-boolean status', async () => {
		expect((await put('tmpl-1', { type: 'transfer' })).status).toBe(400);
		expect((await put('tmpl-1', { name: 'a'.repeat(201) })).status).toBe(400);
		expect((await put('tmpl-1', { isActive: 'yes' })).status).toBe(400);
		const [row] = await db
			.select()
			.from(transactionTemplate)
			.where(eq(transactionTemplate.id, 'tmpl-1'));
		expect(row).toMatchObject({ type: 'expense', name: 'Belanja', isActive: true });
	});

	it('accepts a type change together with a matching category', async () => {
		const response = await put('tmpl-1', { type: 'income', categoryId: 'own-income' });

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			template: { type: 'income', categoryId: 'own-income' }
		});
	});
});
