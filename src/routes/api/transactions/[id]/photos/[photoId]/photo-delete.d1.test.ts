import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { chartOfAccount, transaction, transactionPhoto } from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('#lib/server/db/index.ts', () => ({ getDb: () => dbRef.current }));

import { DELETE } from './+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;
const OWNER = 'photo-owner';
const VICTIM = 'photo-victim';
const OWN_KEY = `receipts/${OWNER}/txn/own.jpg`;
const VICTIM_KEY = `receipts/${VICTIM}/their-txn/secret.jpg`;
const deleted: string[] = [];
const r2 = { delete: async (key: string) => void deleted.push(key) };

function remove(photoId: string) {
	setBindings({ R2: r2 });
	return DELETE({
		params: { id: 'txn', photoId },
		locals: { user: { id: OWNER }, session: { id: 'session' } }
	} as unknown as Parameters<typeof DELETE>[0]);
}

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
	await harness.createUser(OWNER);
	await harness.createUser(VICTIM);
	await harness.db.insert(chartOfAccount).values({
		id: 'kas',
		userId: OWNER,
		code: '1101',
		name: 'Kas',
		type: 'asset'
	});
	await harness.db.insert(transaction).values({
		id: 'txn',
		userId: OWNER,
		date: '2026-05-01',
		type: 'expense',
		amount: 5_000,
		accountId: 'kas'
	});
	const photo = { userId: OWNER, transactionId: 'txn', fileSize: 10, mimeType: 'image/jpeg' };
	await harness.db.insert(transactionPhoto).values([
		{ ...photo, id: 'own', fileName: 'own.jpg', r2Key: OWN_KEY },
		// As the old restore could store: the owner's row naming someone else's object.
		{ ...photo, id: 'planted', fileName: 'x.jpg', r2Key: VICTIM_KEY },
		{ ...photo, id: 'traversal', fileName: 'y.jpg', r2Key: `receipts/${OWNER}/../${VICTIM}/z.jpg` }
	]);
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

async function photoIds() {
	const rows = await harness.db
		.select({ id: transactionPhoto.id })
		.from(transactionPhoto)
		.where(eq(transactionPhoto.userId, OWNER));
	return rows.map((row) => row.id).sort();
}

describe('DELETE /api/transactions/[id]/photos/[photoId]', () => {
	it("removes a row naming another user's object without deleting that object", async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			expect((await remove('planted')).status).toBe(200);
			expect((await remove('traversal')).status).toBe(200);
		} finally {
			warn.mockRestore();
		}
		expect(deleted).toEqual([]);
		expect(await photoIds()).toEqual(['own']);
	});

	it('deletes the row and the object for a key in the owner prefix', async () => {
		expect((await remove('own')).status).toBe(200);
		expect(deleted).toEqual([OWN_KEY]);
		expect(await photoIds()).toEqual([]);
	});
});
