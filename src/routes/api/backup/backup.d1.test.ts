import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	businessProfile,
	chartOfAccount,
	debt,
	onboardingState,
	taxProfile,
	transaction,
	transactionPhoto
} from '#lib/server/db/schema.ts';
import { BACKUP_SCHEMA_VERSION, type BackupDocument } from '#lib/server/backup/format.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';
import { createTestR2, fakeImage } from '#lib/server/testing/r2.ts';
import { readZip, type ZipEntry } from '#lib/shared/zip.ts';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('#lib/server/db/index.ts', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';
import { POST as restore } from '../restore/+server';
import { GET as servePhoto } from '../photos/[...path]/+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;
const OWNER = 'backup-owner';
const OTHER = 'backup-other';
const session = (id: string) => ({ user: { id }, session: { id: `session-${id}` } });
const PHOTO_KEY = `receipts/${OWNER}/deleted/x.jpg`;
const IMAGE = fakeImage('jpg', 3000);
// One bucket for the deployment, as in production: both accounts store their photos in it.
const r2 = createTestR2();

function download(locals: object = session(OWNER), bucket: R2Bucket | null = r2.bucket) {
	setBindings({ R2: bucket });
	return POST({
		locals,
		request: new Request('https://buku.test/api/backup', { method: 'POST' })
	} as unknown as Parameters<typeof POST>[0]);
}

/** The archive's entries, read the way /api/restore reads them. */
async function entriesOf(response: Response) {
	const limits = {
		maxArchiveBytes: 2 ** 30,
		maxEntries: 100,
		maxEntryBytes: 2 ** 24,
		maxTotalBytes: 2 ** 30
	};
	const entries: ZipEntry[] = [];
	for await (const entry of readZip(response.body!, limits)) entries.push(entry);
	const [first, ...images] = entries;
	expect(first.name).toBe('backup.json');
	return {
		file: JSON.parse(new TextDecoder().decode(first.data)) as BackupDocument,
		images: new Map(images.map((entry) => [entry.name, entry.data]))
	};
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
		r2Key: PHOTO_KEY,
		r2Url: `/api/photos/${PHOTO_KEY}`
	});
	await r2.bucket.put(PHOTO_KEY, IMAGE);
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('POST /api/backup', () => {
	it('requires a signed-in user', async () => {
		expect((await download({})).status).toBe(401);
	});

	it("exports every row the owner has and nobody else's, with the photo images", async () => {
		const response = await download();
		expect(response.status).toBe(200);
		const { file, images } = await entriesOf(response);

		expect(file).toMatchObject({
			format: 'buku-umkm-backup',
			schemaVersion: BACKUP_SCHEMA_VERSION,
			businessName: 'Warung Sri & Anak',
			contents: { photoImages: 'included', npwp: 'encrypted' },
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
			expect.objectContaining({ id: 'photo', transactionId: 'deleted', image: 'photos/photo.jpg' })
		]);
		expect(file.photos[0]).not.toHaveProperty('r2Url');
		expect(JSON.stringify(file)).not.toContain(OTHER);
		expect([...images.keys()]).toEqual(['photos/photo.jpg']);
		expect(images.get('photos/photo.jpg')).toEqual(IMAGE);
	});

	it('describes the archive in its headers', async () => {
		const response = await download();
		expect(response.headers.get('Content-Type')).toBe('application/zip');
		expect(response.headers.get('X-Backup-Photo-Images')).toBe('included');
		expect(response.headers.get('X-Backup-Photo-Count')).toBe('1');
		expect(response.headers.get('X-Backup-Photos-Without-Image')).toBe('0');
		expect(response.headers.get('X-Backup-Restorable')).toBe('all');
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('Content-Disposition')).toMatch(
			/^attachment; filename="backup-Warung-Sri-Anak-\d{4}-\d{2}-\d{2}\.zip"$/
		);
		await response.body?.cancel();
	});

	it('leaves out an image that is no longer stored, keeping its photo row', async () => {
		const response = await download(session(OWNER), createTestR2().bucket);
		expect(response.headers.get('X-Backup-Photos-Without-Image')).toBe('1');
		const { file, images } = await entriesOf(response);
		expect(file.photos).toEqual([expect.objectContaining({ id: 'photo', image: null })]);
		expect(images.size).toBe(0);
	});

	it('restores into a new account with the photos, which that account can then open', async () => {
		const zip = await (await download()).arrayBuffer();
		const fresh = 'backup-fresh';
		await harness.createUser(fresh);

		setBindings({ R2: r2.bucket });
		const response = await restore({
			locals: session(fresh),
			request: new Request('https://buku.test/api/restore', {
				method: 'POST',
				body: zip,
				headers: { 'content-type': 'application/zip' }
			})
		} as unknown as Parameters<typeof restore>[0]);

		expect(response.status).toBe(200);
		expect(((await response.json()) as { summary: unknown }).summary).toMatchObject({
			restored: { accounts: 2, transactions: 2, debts: 1, taxProfiles: 1, photos: 1 },
			photosDropped: 0
		});
		const [photo] = await harness.db
			.select()
			.from(transactionPhoto)
			.where(eq(transactionPhoto.userId, fresh));
		expect(photo.r2Key.startsWith(`receipts/${fresh}/`)).toBe(true);
		expect(r2.keysOf(fresh)).toEqual([photo.r2Key]);
		// The owner's image is still there, untouched.
		expect(r2.objects.get(PHOTO_KEY)).toEqual(IMAGE);

		const served = await servePhoto({
			locals: session(fresh),
			params: { path: photo.r2Key }
		} as unknown as Parameters<typeof servePhoto>[0]);
		expect(served.status).toBe(200);
		expect(served.headers.get('Content-Type')).toBe('image/jpeg');
		expect(new Uint8Array(await served.arrayBuffer())).toEqual(IMAGE);
	});
});
