import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { chartOfAccount, transaction, transactionPhoto } from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('#lib/server/db/index.ts', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;
const OWNER = 'upload-owner';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

/** R2 stand-in; `onPut` runs before an object is stored. */
const stored = new Map<string, Uint8Array>();
let onPut: (key: string) => Promise<void> = async () => {};
const r2 = {
	async put(key: string, value: Uint8Array) {
		await onPut(key);
		stored.set(key, value);
	},
	async delete(key: string) {
		stored.delete(key);
	}
};

function upload(
	transactionId: string,
	file: File | null,
	init: { headers?: Record<string, string>; body?: BodyInit } = {}
) {
	const form = new FormData();
	if (file) form.append('file', file);
	setBindings({ R2: r2 });
	return POST({
		params: { id: transactionId },
		locals: { user: { id: OWNER }, session: { id: 'session' } },
		request: new Request(`https://buku.test/api/transactions/${transactionId}/photos`, {
			method: 'POST',
			body: init.body ?? form,
			headers: init.headers,
			duplex: 'half'
		} as RequestInit)
	} as unknown as Parameters<typeof POST>[0]);
}

const jpeg = (name = 'struk.jpg') => new File([JPEG], name, { type: 'image/jpeg' });

async function photosOf(transactionId: string) {
	return harness.db
		.select()
		.from(transactionPhoto)
		.where(eq(transactionPhoto.transactionId, transactionId));
}

let count = 0;
async function newTransaction() {
	const id = `upload-txn-${++count}`;
	await harness.db.insert(transaction).values({
		id,
		userId: OWNER,
		date: '2026-05-01',
		type: 'expense',
		amount: 5_000,
		accountId: 'kas'
	});
	return id;
}

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
	await harness.createUser(OWNER);
	await harness.db
		.insert(chartOfAccount)
		.values({ id: 'kas', userId: OWNER, code: '1101', name: 'Kas', type: 'asset' });
}, 60_000);

beforeEach(() => {
	stored.clear();
	onPut = async () => {};
});

afterAll(async () => {
	await harness?.dispose();
});

describe('POST /api/transactions/[id]/photos', () => {
	it('keeps the three-photo cap when uploads race', async () => {
		const transactionId = await newTransaction();
		// Hold every upload at the R2 write until all six have passed the early count check.
		let arrived = 0;
		let release!: () => void;
		const allArrived = new Promise<void>((resolve) => (release = resolve));
		onPut = async () => {
			if (++arrived === 6) release();
			await allArrived;
		};

		const responses = await Promise.all(
			Array.from({ length: 6 }, (_, i) => upload(transactionId, jpeg(`struk-${i}.jpg`)))
		);

		expect(arrived).toBe(6);
		expect(responses.map((response) => response.status).sort()).toEqual([
			201, 201, 201, 400, 400, 400
		]);
		const rows = await photosOf(transactionId);
		expect(rows).toHaveLength(3);
		// Losers' images were removed again; only the saved rows' objects remain.
		expect([...stored.keys()].sort()).toEqual(rows.map((row) => row.r2Key).sort());
	});

	it('refuses a declared oversized upload without reading it', async () => {
		const transactionId = await newTransaction();
		let pulled = false;
		const body = new ReadableStream(
			{
				pull() {
					pulled = true;
				}
			},
			{ highWaterMark: 0 }
		);
		const response = await upload(transactionId, null, {
			body,
			headers: {
				'content-type': 'multipart/form-data; boundary=x',
				'content-length': String(600 * 1024)
			}
		});

		expect(response.status).toBe(413);
		expect(pulled).toBe(false);
	});

	it('stops reading an undeclared body once it passes the limit', async () => {
		const transactionId = await newTransaction();
		const big = new File([new Uint8Array(2 * 1024 * 1024)], 'besar.jpg', { type: 'image/jpeg' });

		const response = await upload(transactionId, big);

		expect(response.status).toBe(413);
		expect(stored.size).toBe(0);
	});

	it('stores a cleaned, bounded file name', async () => {
		const transactionId = await newTransaction();
		const name = `C:\\Users\\sri\\${'\u202e'}${'struk panjang '.repeat(20)}\n.jpg`;

		const response = await upload(transactionId, jpeg(name));

		expect(response.status).toBe(201);
		const [row] = await photosOf(transactionId);
		expect(row.fileName).not.toMatch(/[\\/\n\u202e]/);
		expect([...row.fileName].length).toBeLessThanOrEqual(120);
		expect(row.fileName.startsWith('struk panjang')).toBe(true);
	});

	it('removes the stored image when the row cannot be saved', async () => {
		const transactionId = await newTransaction();
		// The transaction disappears while the image is being stored.
		onPut = async () => {
			await harness.db.delete(transaction).where(eq(transaction.id, transactionId));
		};

		const response = await upload(transactionId, jpeg());

		expect(response.status).toBe(404);
		expect(stored.size).toBe(0);
		expect(await photosOf(transactionId)).toHaveLength(0);
	});

	it('refuses a file that is not really an image', async () => {
		const transactionId = await newTransaction();
		const fake = new File(['<svg/>'], 'struk.jpg', { type: 'image/jpeg' });

		expect((await upload(transactionId, fake)).status).toBe(400);
		expect(stored.size).toBe(0);
	});
});
