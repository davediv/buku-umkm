import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { category } from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('#lib/server/db/index.ts', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';
import { PATCH, PUT } from './[id]/+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;

const locals = { user: { id: 'owner' }, session: { id: 'session-owner' } };

function request(method: string, body: unknown) {
	return new Request('https://buku.test/api/categories', { method, body: JSON.stringify(body) });
}

function post(body: unknown) {
	return POST({ locals, request: request('POST', body) } as unknown as Parameters<typeof POST>[0]);
}

function put(id: string, body: unknown) {
	return PUT({ locals, params: { id }, request: request('PUT', body) } as unknown as Parameters<
		typeof PUT
	>[0]);
}

function patch(id: string, body: unknown) {
	return PATCH({ locals, params: { id }, request: request('PATCH', body) } as unknown as Parameters<
		typeof PATCH
	>[0]);
}

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
	await harness.createUser('owner');
	await harness.db.insert(category).values({
		id: 'own-expense',
		userId: 'owner',
		code: '5901',
		name: 'Bahan',
		type: 'expense'
	});
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('category API validation', () => {
	it.each([
		['a CSS payload as colour', { color: '#000; background-image: url(https://t.test/b)' }],
		['an unknown icon', { icon: 'Skull' }],
		['a code outside the type range', { code: '4101' }],
		['an overlong name', { name: 'a'.repeat(201) }],
		['an unknown type', { type: 'transfer' }],
		['a non-text name', { name: 42 }]
	])('rejects %s', async (_label, override) => {
		const response = await post({ name: 'Ongkir', type: 'expense', ...override });

		expect(response.status).toBe(400);
		const rows = await harness.db.select().from(category).where(eq(category.userId, 'owner'));
		expect(rows).toHaveLength(1);
	});

	it('creates a category with a valid colour, icon and code', async () => {
		const response = await post({
			name: ' Ongkir ',
			type: 'expense',
			code: '5902',
			icon: 'Truck',
			color: '#14B8A6'
		});

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			category: { name: 'Ongkir', code: '5902', icon: 'Truck', color: '#14b8a6' }
		});
	});

	it('keeps the loan interest codes for the system interest categories', async () => {
		for (const [type, code] of [
			['income', '4901'],
			['expense', '7101']
		]) {
			const response = await post({ name: 'Bunga sendiri', type, code });
			expect(response.status).toBe(400);
			expect(await response.json()).toMatchObject({ error: expect.stringContaining(code) });
		}
	});

	it('caps the name on rename', async () => {
		expect((await put('own-expense', { name: 'a'.repeat(201) })).status).toBe(400);
		expect((await put('own-expense', { name: 7 })).status).toBe(400);
		expect((await put('own-expense', { name: 'Bahan Baku' })).status).toBe(200);
	});

	it('requires a boolean to toggle a category', async () => {
		expect((await patch('own-expense', { isActive: 'false' })).status).toBe(400);
		expect((await patch('own-expense', { isActive: false })).status).toBe(200);
	});
});
