import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { chartOfAccount, transaction } from '$lib/server/db/schema';
import { MAX_BACKUP_BYTES } from '$lib/server/backup/format';
import { createTestD1 } from '$lib/server/testing/d1';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('$lib/server/db', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;
const USER = 'restore-owner';
const locals = { user: { id: USER }, session: { id: 'session-restore' } };

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
	await harness.createUser(USER);
	await harness.db.insert(chartOfAccount).values({
		id: 'existing-kas',
		userId: USER,
		code: '1101',
		name: 'Kas lama',
		type: 'asset',
		balance: 75_000,
		openingBalance: 75_000,
		openingDate: '2026-01-01'
	});
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

function backupFile(transactions = 3) {
	return {
		format: 'buku-umkm-backup',
		schemaVersion: '2.0.0',
		businessProfiles: [],
		onboardingState: null,
		accounts: [
			{ id: 'a1', code: '1101', name: 'Kas', type: 'asset', balance: 30_000, openingBalance: 0 }
		],
		categories: [],
		transactions: Array.from({ length: transactions }, (_, i) => ({
			id: `t${i}`,
			date: '2026-03-01',
			type: 'income',
			amount: 10_000,
			accountId: 'a1'
		})),
		debts: [],
		debtPayments: [],
		taxProfiles: [],
		taxRecords: [],
		templates: [],
		photos: []
	};
}

function call(request: Request, user = locals) {
	return POST({ request, locals: user, platform: undefined } as unknown as Parameters<
		typeof POST
	>[0]);
}

async function accountNames() {
	const rows = await harness.db
		.select({ name: chartOfAccount.name })
		.from(chartOfAccount)
		.where(eq(chartOfAccount.userId, USER));
	return rows.map((row) => row.name);
}

describe('POST /api/restore', () => {
	it('requires a signed-in user', async () => {
		const response = await call(
			new Request('https://buku.test/api/restore', { method: 'POST', body: '{}' }),
			{} as typeof locals
		);
		expect(response.status).toBe(401);
	});

	it('refuses a declared oversized body without reading it', async () => {
		let pulled = false;
		// highWaterMark 0: the stream only pulls when someone reads it.
		const body = new ReadableStream(
			{
				pull() {
					pulled = true;
					throw new Error('the body must not be read');
				}
			},
			{ highWaterMark: 0 }
		);
		const response = await call(
			new Request('https://buku.test/api/restore', {
				method: 'POST',
				body,
				duplex: 'half',
				headers: {
					'content-type': 'application/json',
					'content-length': String(MAX_BACKUP_BYTES + 1)
				}
			} as RequestInit)
		);

		expect(response.status).toBe(413);
		expect(await response.json()).toMatchObject({ code: 'BACKUP_TOO_LARGE' });
		expect(pulled).toBe(false);
		expect(await accountNames()).toEqual(['Kas lama']);
	});

	it('stops reading an undeclared body once it passes the limit', async () => {
		const chunk = new Uint8Array(1024 * 1024).fill(0x20);
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				sent += chunk.byteLength;
				controller.enqueue(chunk);
				if (sent > 4 * MAX_BACKUP_BYTES) controller.close();
			}
		});
		const response = await call(
			new Request('https://buku.test/api/restore', {
				method: 'POST',
				body,
				duplex: 'half',
				headers: { 'content-type': 'application/json' }
			} as RequestInit)
		);

		expect(response.status).toBe(413);
		expect(sent).toBeLessThan(MAX_BACKUP_BYTES + 3 * chunk.byteLength);
		expect(await accountNames()).toEqual(['Kas lama']);
	});

	it.each([
		['text that is not JSON', 'application/json', 'not json', 400],
		['an unsupported content type', 'text/plain', '{}', 415]
	])('refuses %s', async (_label, contentType, body, status) => {
		const response = await call(
			new Request('https://buku.test/api/restore', {
				method: 'POST',
				body,
				headers: { 'content-type': contentType }
			})
		);
		expect(response.status).toBe(status);
		expect(await accountNames()).toEqual(['Kas lama']);
	});

	it('answers an invalid backup with the problem, changing nothing', async () => {
		const file = backupFile();
		file.transactions[1].accountId = 'existing-kas';
		const response = await call(
			new Request('https://buku.test/api/restore', {
				method: 'POST',
				body: JSON.stringify(file),
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error:
				'Data transaksi ke-2 tidak valid: Akun yang dirujuk (accountId) tidak ada di file backup.',
			code: 'INVALID_BACKUP'
		});
		expect(await accountNames()).toEqual(['Kas lama']);
	});

	it('restores an uploaded backup file and summarises it', async () => {
		const form = new FormData();
		form.append('file', new File([JSON.stringify(backupFile(3))], 'backup.json'));
		const response = await call(
			new Request('https://buku.test/api/restore', { method: 'POST', body: form })
		);

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result).toMatchObject({
			success: true,
			summary: { restored: { accounts: 1, transactions: 3 }, photosDropped: 0, npwpDropped: false }
		});
		expect(await accountNames()).toEqual(['Kas']);
		const rows = await harness.db.select().from(transaction).where(eq(transaction.userId, USER));
		expect(rows).toHaveLength(3);
	});
});
