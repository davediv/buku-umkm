import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	businessProfile,
	chartOfAccount,
	debt,
	onboardingState,
	taxProfile,
	transaction,
	transactionPhoto
} from '$lib/server/db/schema';
import { BACKUP_SCHEMA_VERSION, type BackupDocument } from '$lib/server/backup/format';
import { createTestD1 } from '$lib/server/testing/d1';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('$lib/server/db', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';
import { POST as restore } from '../restore/+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;
const OWNER = 'backup-owner';
const OTHER = 'backup-other';
const session = (id: string) => ({ user: { id }, session: { id: `session-${id}` } });

function download(locals: object = session(OWNER)) {
	return POST({
		locals,
		request: new Request('https://buku.test/api/backup', { method: 'POST' })
	} as unknown as Parameters<typeof POST>[0]);
}

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
	const { db } = harness;
	await harness.createUser(OWNER);
	await harness.createUser(OTHER);
	const account = (id: string, userId: string, isActive = true) => ({
		id,
		userId,
		code: '1101',
		name: `Kas ${id}`,
		type: 'asset',
		subType: 'kas',
		isActive,
		balance: 0,
		openingBalance: 0,
		openingDate: '2026-01-01'
	});
	await db
		.insert(chartOfAccount)
		.values([account('kas', OWNER), account('lama', OWNER, false), account('other-kas', OTHER)]);
	await db.insert(debt).values({
		id: 'loan',
		userId: OWNER,
		type: 'hutang',
		kind: 'loan',
		principalAccountId: 'kas',
		contactName: 'Koperasi',
		originalAmount: 1_000_000,
		remainingAmount: 1_000_000,
		date: '2026-02-01'
	});
	await db.insert(transaction).values([
		{
			id: 'principal',
			userId: OWNER,
			date: '2026-02-01',
			type: 'income',
			amount: 1_000_000,
			accountId: 'kas',
			debtId: 'loan'
		},
		{
			id: 'deleted',
			userId: OWNER,
			date: '2026-02-02',
			type: 'expense',
			amount: 5_000,
			accountId: 'kas',
			isActive: false
		},
		{
			id: 'other-sale',
			userId: OTHER,
			date: '2026-02-02',
			type: 'income',
			amount: 9_000,
			accountId: 'other-kas'
		}
	]);
	await db.update(debt).set({ principalTransactionId: 'principal' });
	await db.insert(onboardingState).values({ userId: OWNER, status: 'completed' });
	await db.insert(businessProfile).values({
		id: 'profile',
		userId: OWNER,
		name: 'Warung Sri & Anak',
		businessType: 'warung_makan',
		npwp: 'stored-ciphertext'
	});
	await db.insert(taxProfile).values({
		id: 'tax-2026',
		userId: OWNER,
		taxYear: 2026,
		legalForm: 'individual',
		registeredAt: '2020-01-15',
		finalRegimeStartYear: 2020,
		regimeChoice: 'final_umkm'
	});
	await db.insert(transactionPhoto).values({
		id: 'photo',
		userId: OWNER,
		transactionId: 'deleted',
		fileName: 'struk.jpg',
		fileSize: 2048,
		mimeType: 'image/jpeg',
		r2Key: `receipts/${OWNER}/deleted/x.jpg`,
		r2Url: `/api/photos/receipts/${OWNER}/deleted/x.jpg`
	});
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('POST /api/backup', () => {
	it('requires a signed-in user', async () => {
		expect((await download({})).status).toBe(401);
	});

	it("exports every row the owner has and nobody else's", async () => {
		const response = await download();
		expect(response.status).toBe(200);
		const file = (await response.json()) as BackupDocument;

		expect(file).toMatchObject({
			format: 'buku-umkm-backup',
			schemaVersion: BACKUP_SCHEMA_VERSION,
			businessName: 'Warung Sri & Anak',
			contents: { photoImages: 'not_included', npwp: 'encrypted' },
			onboardingState: { status: 'completed' },
			businessProfiles: [{ npwp: 'stored-ciphertext' }],
			taxProfiles: [{ taxYear: 2026, groupTurnoverExceeded: null }]
		});
		expect(file.accounts.map((item) => item.id).sort()).toEqual(['kas', 'lama']);
		// The deleted transaction too: the photo below still points at it.
		expect(file.transactions.map((item) => item.id).sort()).toEqual(['deleted', 'principal']);
		expect(file.debts).toEqual([
			expect.objectContaining({
				id: 'loan',
				kind: 'loan',
				principalAccountId: 'kas',
				principalTransactionId: 'principal'
			})
		]);
		expect(file.photos).toEqual([
			expect.objectContaining({ id: 'photo', transactionId: 'deleted' })
		]);
		expect(file.photos[0]).not.toHaveProperty('r2Url');
		expect(JSON.stringify(file)).not.toContain(OTHER);
	});

	it('tells the client the photo images are not in the file', async () => {
		const response = await download();
		expect(response.headers.get('X-Backup-Photo-Images')).toBe('not-included');
		expect(response.headers.get('X-Backup-Photo-Count')).toBe('1');
		expect(response.headers.get('X-Backup-Restorable')).toBe('true');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('Content-Disposition')).toMatch(
			/^attachment; filename="backup-Warung-Sri-Anak-\d{4}-\d{2}-\d{2}\.json"$/
		);
	});

	it('produces a file that /api/restore accepts', async () => {
		const file = await (await download()).text();
		const fresh = 'backup-fresh';
		await harness.createUser(fresh);
		const form = new FormData();
		form.append('file', new File([file], 'backup.json'));

		const response = await restore({
			locals: session(fresh),
			request: new Request('https://buku.test/api/restore', { method: 'POST', body: form })
		} as unknown as Parameters<typeof restore>[0]);

		expect(response.status).toBe(200);
		expect(((await response.json()) as { summary: unknown }).summary).toMatchObject({
			restored: { accounts: 2, transactions: 2, debts: 1, taxProfiles: 1, photos: 0 },
			// Different account, so the image is not in its storage.
			photosDropped: 1
		});
	});
});
