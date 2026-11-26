import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { category } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { resolveTemplateCategory } from './category';

let harness: Awaited<ReturnType<typeof createTestD1>>;
let ownerId: string;
let otherId: string;

async function insertCategory(
	userId: string,
	id: string,
	type: 'income' | 'expense',
	isActive = true
) {
	await harness.db.insert(category).values({
		id,
		userId,
		code: id,
		name: `Kategori ${id}`,
		type,
		isSystem: false,
		isActive
	});
}

beforeAll(async () => {
	harness = await createTestD1();
	ownerId = await harness.createUser('owner');
	otherId = await harness.createUser('other');
	await insertCategory(ownerId, 'own-expense', 'expense');
	await insertCategory(ownerId, 'own-income', 'income');
	await insertCategory(ownerId, 'own-inactive', 'expense', false);
	await insertCategory(otherId, 'foreign-expense', 'expense');
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('resolveTemplateCategory on D1', () => {
	it.each([undefined, null, ''])('treats %s as no category', async (categoryId) => {
		await expect(
			resolveTemplateCategory(harness.db, ownerId, categoryId, 'expense')
		).resolves.toEqual({ ok: true, category: null });
	});

	it("accepts the user's own active category of the same type", async () => {
		await expect(
			resolveTemplateCategory(harness.db, ownerId, 'own-expense', 'expense')
		).resolves.toEqual({ ok: true, category: { id: 'own-expense', name: 'Kategori own-expense' } });
	});

	it("rejects another user's category exactly like a missing one", async () => {
		const foreign = await resolveTemplateCategory(
			harness.db,
			ownerId,
			'foreign-expense',
			'expense'
		);
		const missing = await resolveTemplateCategory(harness.db, ownerId, 'no-such-id', 'expense');

		expect(foreign).toEqual({ ok: false, error: 'Kategori tidak ditemukan' });
		expect(missing).toEqual(foreign);
	});

	it('rejects an inactive category', async () => {
		await expect(
			resolveTemplateCategory(harness.db, ownerId, 'own-inactive', 'expense')
		).resolves.toMatchObject({ ok: false });
	});

	it('rejects a category of the other type', async () => {
		await expect(
			resolveTemplateCategory(harness.db, ownerId, 'own-income', 'expense')
		).resolves.toEqual({
			ok: false,
			error: 'Pilih kategori pengeluaran untuk template pengeluaran'
		});
	});

	it('rejects a non-string id', async () => {
		await expect(
			resolveTemplateCategory(harness.db, ownerId, { id: 'own-expense' }, 'expense')
		).resolves.toMatchObject({ ok: false });
	});
});
