import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { enforcePasswordPolicy } from '$lib/server/security/password-policy';
import { deleteUserOptions, deleteUserReceipts, type ReceiptBucket } from './deletion';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

const PASSWORD = 'Rahasia123';

/** An in-memory stand-in for the R2 binding, with an optional failure on the nth delete call. */
function fakeBucket(keys: string[] = [], { failOnDelete }: { failOnDelete?: number } = {}) {
	const objects = new Set(keys);
	let deletes = 0;
	const bucket: ReceiptBucket & { keys(prefix?: string): string[] } = {
		keys: (prefix = '') => [...objects].filter((key) => key.startsWith(prefix)).sort(),
		async list({ prefix, limit }) {
			return {
				objects: bucket
					.keys(prefix)
					.slice(0, limit)
					.map((key) => ({ key }))
			};
		},
		async delete(batch) {
			if (++deletes === failOnDelete) throw new Error('R2 unavailable');
			expect(batch.length).toBeLessThanOrEqual(1000);
			for (const key of batch) objects.delete(key);
		}
	};
	return bucket;
}

function createAuth(bucket: ReceiptBucket | undefined) {
	return betterAuth({
		baseURL: 'http://localhost:8792',
		secret: 'test-secret-0123456789abcdef0123456789',
		database: drizzleAdapter(harness.db, { provider: 'sqlite' }),
		emailAndPassword: { enabled: true },
		user: { deleteUser: deleteUserOptions({ getBucket: () => bucket, getDb: () => harness.db }) },
		hooks: { before: enforcePasswordPolicy },
		logger: { disabled: true }
	});
}

type Auth = ReturnType<typeof createAuth>;

/** Signs a new user up and returns their id and session cookie. */
async function signUp(auth: Auth, email: string) {
	const { headers, response } = await auth.api.signUpEmail({
		body: { email, password: PASSWORD, name: 'Pemilik Toko' },
		returnHeaders: true
	});
	const cookie = headers
		.getSetCookie()
		.map((value) => value.split(';')[0])
		.join('; ');
	return { userId: response.user.id, cookie };
}

/** One or more rows in every table that belongs to a user, linked the way the app links them. */
async function seedBooks(userId: string) {
	const { db } = harness;
	const id = (name: string) => `${name}-${userId}`;
	await db.insert(schema.userExtension).values({ id: userId, businessName: 'Warung Ayu' });
	await db.insert(schema.onboardingState).values({ userId, status: 'completed' });
	await db.insert(schema.businessProfile).values({
		id: id('profile'),
		userId,
		name: 'Warung Ayu',
		businessType: 'warung_makan',
		npwp: 'encrypted-npwp'
	});
	await db.insert(schema.chartOfAccount).values([
		{ id: id('cash'), userId, code: '1101', name: 'Kas', type: 'asset', subType: 'kas' },
		{ id: id('bank'), userId, code: '1102', name: 'Bank', type: 'asset', subType: 'bank' }
	]);
	await db.insert(schema.category).values({
		id: id('sales'),
		userId,
		code: '4101',
		name: 'Penjualan',
		type: 'income'
	});
	await db.insert(schema.debt).values({
		id: id('debt'),
		userId,
		type: 'hutang',
		kind: 'loan',
		principalAccountId: id('cash'),
		contactName: 'Koperasi Sejahtera',
		contactPhone: '0812-0000-1111',
		originalAmount: 500_000,
		remainingAmount: 400_000,
		date: '2026-10-01'
	});
	await db.insert(schema.transaction).values([
		{
			id: id('sale'),
			userId,
			date: '2026-10-02',
			type: 'income',
			amount: 150_000,
			accountId: id('cash'),
			categoryId: id('sales'),
			description: 'Nasi goreng'
		},
		{
			id: id('transfer'),
			userId,
			date: '2026-10-03',
			type: 'transfer',
			amount: 50_000,
			accountId: id('cash'),
			toAccountId: id('bank'),
			debtId: id('debt')
		}
	]);
	await db
		.update(schema.debt)
		.set({ principalTransactionId: id('transfer') })
		.where(eq(schema.debt.id, id('debt')));
	await db.insert(schema.debtPayment).values({
		id: id('payment'),
		debtId: id('debt'),
		userId,
		amount: 100_000,
		date: '2026-10-10',
		accountId: id('cash'),
		transactionId: id('transfer')
	});
	await db.insert(schema.transactionPhoto).values({
		id: id('photo'),
		transactionId: id('sale'),
		userId,
		fileName: 'nota.jpg',
		fileSize: 1234,
		mimeType: 'image/jpeg',
		r2Key: `receipts/${userId}/${id('sale')}/photo.jpg`
	});
	await db.insert(schema.taxProfile).values({
		id: id('tax-profile'),
		userId,
		taxYear: 2026,
		legalForm: 'orang_pribadi',
		registeredAt: '2024-01-01',
		finalRegimeStartYear: 2024,
		regimeChoice: 'pph_final'
	});
	await db.insert(schema.taxRecord).values({
		id: id('tax-record'),
		userId,
		year: 2026,
		month: 10,
		taxType: 'pph_final',
		taxableIncome: 150_000,
		taxRate: 50,
		taxAmount: 750
	});
	await db.insert(schema.backup).values({
		id: id('backup'),
		userId,
		type: 'full',
		fileName: 'cadangan.json',
		fileSize: 2048,
		r2Key: `backups/${userId}/cadangan.json`,
		recordCount: 10,
		includes: '["transaction"]'
	});
	await db.insert(schema.transactionTemplate).values({
		id: id('template'),
		userId,
		name: 'Penjualan harian',
		type: 'income',
		categoryId: id('sales')
	});
	await db.insert(schema.financialCommand).values({
		userId,
		idempotencyKey: id('command'),
		kind: 'create_transaction',
		result: '{}'
	});
	await db.insert(schema.verification).values({
		id: id('reset'),
		identifier: `reset-password:${id('token')}`,
		value: userId,
		expiresAt: new Date(Date.now() + 3_600_000)
	});
}

/** Tables whose rows cannot belong to a user, so they need no user_id. */
const TABLES_WITHOUT_OWNER = new Set(['finance_guard', 'verification', 'd1_migrations']);

/** Every table with a foreign key to `user`, and the column that holds the owner's id. */
async function userOwnedTables(): Promise<{ table: string; column: string }[]> {
	const { results: tables } = await harness.d1
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'"
		)
		.all<{ name: string }>();
	const owned: { table: string; column: string }[] = [];
	for (const { name } of tables) {
		const { results: keys } = await harness.d1
			.prepare(`PRAGMA foreign_key_list("${name}")`)
			.all<{ table: string; from: string }>();
		const ownerKey = keys.find((key) => key.table === 'user');
		if (ownerKey) owned.push({ table: name, column: ownerKey.from });
		else if (name !== 'user') {
			// A new table must either reference user (and be seeded above) or be listed here.
			expect(TABLES_WITHOUT_OWNER, `table "${name}" has no owner column`).toContain(name);
		}
	}
	return owned;
}

async function rowCounts(userId: string): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const { table, column } of await userOwnedTables()) {
		const row = await harness.d1
			.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${column}" = ?`)
			.bind(userId)
			.first<{ n: number }>();
		counts[table] = row?.n ?? 0;
	}
	for (const [table, column] of [
		['user', 'id'],
		['verification', 'value']
	]) {
		const row = await harness.d1
			.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${column}" = ?`)
			.bind(userId)
			.first<{ n: number }>();
		counts[table] = row?.n ?? 0;
	}
	return counts;
}

function receiptKeys(userId: string, count: number): string[] {
	return Array.from({ length: count }, (_, i) => `receipts/${userId}/trx-${i % 7}/photo-${i}.jpg`);
}

describe('account deletion', () => {
	it('removes the user from every table and every receipt photo, and nothing of others', async () => {
		const auth = createAuth(fakeBucket());
		const owner = await signUp(auth, 'ayu@example.com');
		const other = await signUp(auth, 'budi@example.com');
		// A second device.
		await auth.api.signInEmail({ body: { email: 'ayu@example.com', password: PASSWORD } });
		await seedBooks(owner.userId);
		await seedBooks(other.userId);
		const ownerKeys = receiptKeys(owner.userId, 2_345);
		const otherKeys = receiptKeys(other.userId, 3);
		// Shares the owner's id as a string prefix but is another folder.
		const lookalike = `receipts/${owner.userId}-x/photo.jpg`;
		const filled = fakeBucket([...ownerKeys, ...otherKeys, lookalike]);
		const deleting = createAuth(filled);

		const before = await rowCounts(owner.userId);
		const othersBefore = await rowCounts(other.userId);
		expect(Object.keys(before)).toEqual(
			expect.arrayContaining([
				'user',
				'session',
				'account',
				'verification',
				'user_extension',
				'onboarding_state',
				'financial_command',
				'business_profile',
				'chart_of_account',
				'category',
				'transaction',
				'transaction_photo',
				'debt',
				'debt_payment',
				'tax_profile',
				'tax_record',
				'backup',
				'transaction_template'
			])
		);
		const emptyTables = Object.entries(before).filter(([, n]) => n === 0);
		expect(emptyTables, 'seedBooks must fill every user-owned table').toEqual([]);
		expect(before.session).toBe(2);

		const result = await deleting.api.deleteUser({
			body: { password: PASSWORD },
			headers: new Headers({ cookie: owner.cookie })
		});

		expect(result).toEqual({ success: true, message: 'User deleted' });
		const after = await rowCounts(owner.userId);
		expect(Object.entries(after).filter(([, n]) => n > 0)).toEqual([]);
		expect(await rowCounts(other.userId)).toEqual(othersBefore);
		expect(filled.keys(`receipts/${owner.userId}/`)).toEqual([]);
		expect(filled.keys()).toEqual([lookalike, ...otherKeys].sort());
		expect(
			await deleting.api.getSession({ headers: new Headers({ cookie: owner.cookie }) })
		).toBeNull();
	});

	it('keeps everything when the password is wrong or missing', async () => {
		const bucket = fakeBucket();
		const auth = createAuth(bucket);
		const owner = await signUp(auth, 'citra@example.com');
		await seedBooks(owner.userId);
		const keys = receiptKeys(owner.userId, 3);
		const filled = fakeBucket(keys);
		const deleting = createAuth(filled);
		const before = await rowCounts(owner.userId);
		const headers = new Headers({ cookie: owner.cookie });

		await expect(
			deleting.api.deleteUser({ body: { password: 'Salah12345' }, headers })
		).rejects.toMatchObject({ body: { code: 'INVALID_PASSWORD' } });
		await expect(deleting.api.deleteUser({ body: {}, headers })).rejects.toMatchObject({
			body: { code: 'PASSWORD_REQUIRED' }
		});

		expect(await rowCounts(owner.userId)).toEqual(before);
		expect(filled.keys()).toEqual(keys.sort());
	});

	it('leaves the account whole when R2 fails, so deleting again finishes the job', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const auth = createAuth(fakeBucket());
		const owner = await signUp(auth, 'dewi@example.com');
		await seedBooks(owner.userId);
		const keys = receiptKeys(owner.userId, 2_500);
		const flaky = fakeBucket(keys, { failOnDelete: 2 });
		const before = await rowCounts(owner.userId);
		const headers = new Headers({ cookie: owner.cookie });

		await expect(
			createAuth(flaky).api.deleteUser({ body: { password: PASSWORD }, headers })
		).rejects.toMatchObject({ body: { code: 'RECEIPTS_NOT_DELETED' } });

		expect(await rowCounts(owner.userId)).toEqual(before);
		expect(flaky.keys().length).toBe(1_500);
		expect(await auth.api.getSession({ headers })).not.toBeNull();

		await createAuth(flaky).api.deleteUser({ body: { password: PASSWORD }, headers });
		expect(Object.values(await rowCounts(owner.userId)).every((n) => n === 0)).toBe(true);
		expect(flaky.keys()).toEqual([]);
		vi.restoreAllMocks();
	});

	it('refuses to delete when the receipt bucket is not configured', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const auth = createAuth(undefined);
		const owner = await signUp(auth, 'eka@example.com');

		await expect(
			auth.api.deleteUser({
				body: { password: PASSWORD },
				headers: new Headers({ cookie: owner.cookie })
			})
		).rejects.toMatchObject({ body: { code: 'RECEIPTS_NOT_DELETED' } });
		expect((await rowCounts(owner.userId)).user).toBe(1);
		vi.restoreAllMocks();
	});
});

describe('deleteUserReceipts', () => {
	it('never widens the prefix to other users', async () => {
		const bucket = fakeBucket(['receipts/a/1.jpg', 'receipts/b/2.jpg']);
		await expect(deleteUserReceipts(bucket, '')).rejects.toThrow();
		await expect(deleteUserReceipts(bucket, 'a/../b')).rejects.toThrow();
		expect(bucket.keys()).toHaveLength(2);
	});

	it('stops instead of looping when R2 keeps listing deleted objects', async () => {
		const stuck: ReceiptBucket = {
			list: async () => ({ objects: [{ key: 'receipts/u/1.jpg' }] }),
			delete: async () => {}
		};
		await expect(deleteUserReceipts(stuck, 'u')).rejects.toThrow('just deleted');
	});
});
