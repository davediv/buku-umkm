import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, asc, eq, getTableName } from 'drizzle-orm';
import {
	businessProfile,
	category,
	chartOfAccount,
	debt,
	debtPayment,
	financialCommand,
	onboardingState,
	taxProfile,
	taxRecord,
	transaction,
	transactionPhoto,
	transactionTemplate
} from '$lib/server/db/schema';
import { dashboardQueries } from '$lib/server/db/queries';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { getBalanceSheetAsOf } from '$lib/server/reports/balance-sheet';
import { getRecordedMonthlyRevenue } from '$lib/tax/service';
import { createTestD1 } from '$lib/server/testing/d1';
import { buildBackupDocument } from './export';
import { BackupError } from './parse';
import { MAX_RESTORE_ROWS } from './format';
import { restoreBackup, type RestoreOptions } from './restore';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

const USER_TABLES = [
	businessProfile,
	chartOfAccount,
	category,
	transaction,
	debt,
	debtPayment,
	taxProfile,
	taxRecord,
	transactionTemplate,
	transactionPhoto,
	financialCommand,
	onboardingState
] as const;

/** An R2 stand-in that only lists, as restore does. */
function fakeReceipts(keys: string[] = []) {
	const objects = new Map(keys.map((key) => [key, 1234]));
	const bucket = {
		async list({ prefix = '', cursor, limit = 1000 }: R2ListOptions = {}) {
			const matching = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
			const start = cursor ? Number(cursor) : 0;
			const truncated = start + limit < matching.length;
			return {
				objects: matching
					.slice(start, start + limit)
					.map((key) => ({ key, size: objects.get(key)! })),
				truncated,
				cursor: truncated ? String(start + limit) : undefined,
				delimitedPrefixes: []
			};
		}
	};
	return { objects, bucket: bucket as unknown as Pick<R2Bucket, 'list'> };
}

/** Opens only the ciphertext "cipher-ok", as a deployment with that key would. */
const decryptNpwp = async (value: string) => (value === 'cipher-ok' ? '012345678901234' : null);

/** The user's backup file as it would be downloaded and uploaded again. */
async function snapshot(userId: string) {
	return JSON.parse(JSON.stringify(await buildBackupDocument(harness.db, userId)));
}

async function rowCounts(userId: string) {
	const counts: Record<string, number> = {};
	for (const table of USER_TABLES) {
		const rows = await harness.db.select().from(table).where(eq(table.userId, userId));
		counts[getTableName(table)] = rows.length;
	}
	return counts;
}

/** Everything the reports show, without ids (restore gives every row a new one). */
async function reports(userId: string) {
	const { db } = harness;
	const today = '2026-11-20';
	const [overview, cashFlow, balanceSheet, revenue, accounts, debts] = await Promise.all([
		dashboardQueries.getOverview(db, userId, 'monthly', today),
		dashboardQueries.getCashFlow(db, userId, 12, today),
		getBalanceSheetAsOf(db, userId, today),
		getRecordedMonthlyRevenue(db, userId, 2026),
		db
			.select()
			.from(chartOfAccount)
			.where(eq(chartOfAccount.userId, userId))
			.orderBy(asc(chartOfAccount.code)),
		db.query.debt.findMany({
			where: (item, { eq }) => eq(item.userId, userId),
			orderBy: (item, { asc }) => [asc(item.contactName)],
			with: { payments: { orderBy: (payment, { asc }) => [asc(payment.date)] } }
		})
	]);
	return JSON.parse(
		JSON.stringify({ overview, cashFlow, balanceSheet, revenue, accounts, debts }, (key, value) =>
			key === 'id' || key.endsWith('Id') ? undefined : value
		)
	);
}

/**
 * A year of books kept through the finance service: 56 transactions (one deleted), a
 * transfer, trade debts with payments, a loan with its principal, an inactive account
 * that still holds money, templates, tax data, a profile and a receipt photo.
 */
async function seedBooks(userId: string) {
	const { db } = harness;
	const service = createFinancialMutationService(createD1FinanceRepository(db));
	let keyCount = 0;
	const key = () => `restore-${userId}-${++keyCount}`;
	const [kas, bank, dompet, sales, supplies] = Array.from({ length: 5 }, () => crypto.randomUUID());

	await db.insert(chartOfAccount).values([
		{
			id: kas,
			userId,
			code: '1101',
			name: 'Kas',
			type: 'asset',
			subType: 'kas',
			isSystem: true,
			balance: 5_000_000,
			openingBalance: 5_000_000,
			openingDate: '2026-01-01'
		},
		{
			id: bank,
			userId,
			code: '1102',
			name: 'Bank BCA',
			type: 'asset',
			subType: 'bank',
			balance: 0,
			openingBalance: 0,
			openingDate: '2026-01-01'
		},
		// Deactivated while holding money, as older versions allowed: reports still count it.
		{
			id: dompet,
			userId,
			code: '1103',
			name: 'GoPay lama',
			type: 'asset',
			subType: 'ewallet',
			isActive: false,
			balance: 250_000,
			openingBalance: 250_000,
			openingDate: '2025-12-01'
		}
	]);
	await db.insert(category).values([
		{
			id: sales,
			userId,
			code: '4101',
			name: 'Penjualan',
			type: 'income',
			isSystem: true,
			icon: 'ShoppingCart',
			color: '#22c55e'
		},
		{ id: supplies, userId, code: '5101', name: 'Bahan baku', type: 'expense', icon: 'Package' }
	]);

	const created: string[] = [];
	for (let i = 0; i < 56; i++) {
		const income = i % 3 !== 0;
		const { entity } = await service.createTransaction(userId, key(), {
			type: income ? 'income' : 'expense',
			amount: 10_000 * (i + 1),
			accountId: i % 4 === 0 ? bank : kas,
			categoryId: income ? sales : supplies,
			date: `2026-${String((i % 10) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
			description: `Transaksi ${i + 1}`,
			referenceNumber: i % 5 === 0 ? `INV-${i}` : null,
			notes: i % 7 === 0 ? 'Catatan' : null
		});
		created.push(entity.id);
	}
	await service.deleteTransaction(userId, created[1]);
	await service.createTransfer(userId, key(), {
		amount: 1_000_000,
		sourceAccountId: kas,
		destinationAccountId: bank,
		date: '2026-06-15',
		description: 'Setor ke bank'
	});

	const debtInput = {
		accountId: null,
		contactPhone: null,
		contactAddress: null,
		dueDate: null,
		description: null
	};
	const receivable = await service.createDebt(userId, key(), {
		...debtInput,
		type: 'piutang',
		kind: 'trade',
		contactName: 'Bu Sri',
		contactPhone: '0812-5555-0101',
		originalAmount: 300_000,
		date: '2026-04-10',
		dueDate: '2026-12-31'
	});
	await service.recordDebtPayment(userId, receivable.entity.id, key(), {
		amount: 100_000,
		date: '2026-05-01',
		accountId: kas,
		notes: 'Cicilan 1'
	});
	const payable = await service.createDebt(userId, key(), {
		...debtInput,
		type: 'hutang',
		kind: 'trade',
		contactName: 'Toko Makmur',
		originalAmount: 200_000,
		date: '2026-03-05'
	});
	await service.recordDebtPayment(userId, payable.entity.id, key(), {
		amount: 200_000,
		date: '2026-03-20',
		accountId: kas,
		notes: null
	});
	const loan = await service.createDebt(userId, key(), {
		...debtInput,
		type: 'hutang',
		kind: 'loan',
		accountId: bank,
		contactName: 'Koperasi Maju',
		originalAmount: 2_000_000,
		date: '2026-02-01'
	});
	await service.recordDebtPayment(userId, loan.entity.id, key(), {
		amount: 500_000,
		date: '2026-07-01',
		accountId: bank,
		notes: 'Angsuran'
	});

	await db.insert(transactionTemplate).values([
		{ id: crypto.randomUUID(), userId, name: 'Jual nasi', type: 'income', categoryId: sales },
		{ id: crypto.randomUUID(), userId, name: 'Belanja', type: 'expense', isActive: false }
	]);
	await db.insert(taxProfile).values({
		id: crypto.randomUUID(),
		userId,
		taxYear: 2026,
		legalForm: 'individual',
		registeredAt: '2020-01-15',
		finalRegimeStartYear: 2020,
		regimeChoice: 'final_umkm',
		externalMonthlyRevenue: JSON.stringify(Array(12).fill(0)),
		revenueDataComplete: true,
		groupTurnoverExceeded: true
	});
	await db.insert(taxRecord).values({
		id: crypto.randomUUID(),
		userId,
		year: 2026,
		month: 3,
		taxType: 'pph_final',
		taxableIncome: 1_000_000,
		taxRate: 50,
		taxAmount: 5_000,
		paidAmount: 4_000,
		status: 'paid',
		billingCode: '123456789012345',
		paymentDate: '2026-04-10'
	});
	await db.insert(businessProfile).values({
		id: crypto.randomUUID(),
		userId,
		name: 'Warung Sri',
		businessType: 'warung_makan',
		ownerName: 'Sri',
		npwp: 'cipher-ok'
	});
	await db
		.insert(onboardingState)
		.values({ userId, status: 'completed', completedAt: new Date('2026-01-01T00:00:00Z') });

	const photoKey = `receipts/${userId}/${created[2]}/${crypto.randomUUID()}.jpg`;
	await db.insert(transactionPhoto).values({
		id: crypto.randomUUID(),
		userId,
		transactionId: created[2],
		fileName: 'struk.jpg',
		fileSize: 1234,
		mimeType: 'image/jpeg',
		r2Key: photoKey,
		r2Url: `/api/photos/${photoKey}`
	});
	return { kas, bank, sales, created, photoKey, loanId: loan.entity.id };
}

async function expectRejected(
	userId: string,
	file: unknown,
	message: RegExp,
	options: RestoreOptions = {}
) {
	const before = await rowCounts(userId);
	const failure = await restoreBackup(harness.db, userId, file, { decryptNpwp, ...options }).then(
		() => null,
		(error: unknown) => error
	);
	expect(failure).toBeInstanceOf(BackupError);
	expect((failure as BackupError).message).toMatch(message);
	expect(await rowCounts(userId)).toEqual(before);
	return failure as BackupError;
}

describe('restoreBackup', () => {
	it('round-trips a realistic book into the same account with the same reports', async () => {
		const userId = await harness.createUser();
		const { photoKey } = await seedBooks(userId);
		const file = await snapshot(userId);
		const before = await reports(userId);
		const oldIds = new Set((await harness.db.select().from(transaction)).map((item) => item.id));
		const { bucket } = fakeReceipts([photoKey]);

		const summary = await restoreBackup(harness.db, userId, file, {
			receipts: bucket,
			decryptNpwp
		});

		expect(summary).toEqual({
			schemaVersion: '2.0.0',
			restored: {
				businessProfile: 1,
				accounts: 3,
				categories: 2,
				// 56 entries, the transfer's two legs, 3 payments and the loan principal.
				transactions: 62,
				debts: 3,
				debtPayments: 3,
				taxProfiles: 1,
				taxRecords: 1,
				templates: 2,
				photos: 1
			},
			photosDropped: 0,
			npwpDropped: false
		});
		expect(await reports(userId)).toEqual(before);

		const restored = await harness.db
			.select()
			.from(transaction)
			.where(eq(transaction.userId, userId));
		expect(restored.filter((item) => oldIds.has(item.id))).toEqual([]);
		expect(restored.filter((item) => !item.isActive)).toHaveLength(1);
		const [loan] = await harness.db
			.select()
			.from(debt)
			.where(and(eq(debt.userId, userId), eq(debt.kind, 'loan')));
		const principal = restored.find((item) => item.id === loan.principalTransactionId);
		expect(principal?.debtId).toBe(loan.id);
		expect(principal?.accountId).toBe(loan.principalAccountId);
		const [photo] = await harness.db
			.select()
			.from(transactionPhoto)
			.where(eq(transactionPhoto.userId, userId));
		expect(photo).toMatchObject({ r2Key: photoKey, r2Url: `/api/photos/${photoKey}` });
		expect(restored.some((item) => item.id === photo.transactionId)).toBe(true);
		const [profile] = await harness.db
			.select()
			.from(businessProfile)
			.where(eq(businessProfile.userId, userId));
		expect(profile.npwp).toBe('cipher-ok');
		const [eligibility] = await harness.db
			.select()
			.from(taxProfile)
			.where(eq(taxProfile.userId, userId));
		expect(eligibility).toMatchObject({ taxYear: 2026, groupTurnoverExceeded: true });
		const [record] = await harness.db.select().from(taxRecord).where(eq(taxRecord.userId, userId));
		expect(record).toMatchObject({ month: 3, taxAmount: 5_000, paidAmount: 4_000 });
		// Idempotency keys named the old rows; replaying one must not find a stale result.
		expect((await rowCounts(userId)).financial_command).toBe(0);
	});

	it('restores into another account with the same reports, dropping photos it cannot see', async () => {
		const owner = await harness.createUser();
		const { photoKey } = await seedBooks(owner);
		const file = await snapshot(owner);
		const before = await reports(owner);
		const fresh = await harness.createUser();
		const { bucket } = fakeReceipts([photoKey]);

		const summary = await restoreBackup(harness.db, fresh, file, { receipts: bucket, decryptNpwp });

		expect(summary.restored.photos).toBe(0);
		expect(summary.photosDropped).toBe(1);
		expect(await reports(fresh)).toEqual(before);
		// The source account is untouched.
		expect(await reports(owner)).toEqual(before);
	});

	it('drops an NPWP this deployment cannot decrypt and says so', async () => {
		const userId = await harness.createUser();
		await seedBooks(userId);
		const file = await snapshot(userId);
		file.businessProfiles[0].npwp = 'encrypted-elsewhere';

		const summary = await restoreBackup(harness.db, userId, file, { decryptNpwp });

		expect(summary.npwpDropped).toBe(true);
		const [profile] = await harness.db
			.select()
			.from(businessProfile)
			.where(eq(businessProfile.userId, userId));
		expect(profile).toMatchObject({ name: 'Warung Sri', npwp: null });
	});

	it('restores a 1.x backup: trade debts, derived opening balances, orphan photos dropped', async () => {
		const userId = await harness.createUser();
		const summary = await restoreBackup(
			harness.db,
			userId,
			{
				schemaVersion: '1.0.0',
				businessProfiles: [],
				accounts: [{ id: 'a1', code: '1101', name: 'Kas', type: 'asset', balance: 150_000 }],
				categories: [],
				transactions: [
					{
						id: 't1',
						date: '2026-02-03',
						type: 'income',
						amount: 50_000,
						accountId: 'a1',
						debtId: 'd1'
					}
				],
				debts: [
					{
						id: 'd1',
						type: 'piutang',
						contactName: 'Pak Budi',
						originalAmount: 80_000,
						paidAmount: 50_000,
						remainingAmount: 30_000,
						date: '2026-02-01',
						status: 'active'
					}
				],
				debtPayments: [
					{
						id: 'p1',
						debtId: 'd1',
						amount: 50_000,
						date: '2026-02-03',
						accountId: 'a1',
						transactionId: 't1'
					}
				],
				// Written before one record per period was enforced: the newer one wins.
				taxRecords: [
					{
						id: 'r1',
						year: 2026,
						month: 2,
						taxType: 'pph_final',
						taxableIncome: 50_000,
						taxRate: 50,
						taxAmount: 250,
						updatedAt: '2026-03-01T00:00:00.000Z'
					},
					{
						id: 'r2',
						year: 2026,
						month: 2,
						taxType: 'pph_final',
						taxableIncome: 50_000,
						taxRate: 50,
						taxAmount: 250,
						status: 'paid',
						updatedAt: '2026-03-09T00:00:00.000Z'
					}
				],
				templates: [],
				photos: [{ id: 'f1', transactionId: 'deleted-transaction', r2Key: 'x' }]
			},
			{ decryptNpwp }
		);

		expect(summary.photosDropped).toBe(1);
		expect(summary.restored.taxRecords).toBe(1);
		const records = await harness.db.select().from(taxRecord).where(eq(taxRecord.userId, userId));
		expect(records.map(({ status, paidAmount }) => ({ status, paidAmount }))).toEqual([
			{ status: 'paid', paidAmount: 250 }
		]);
		const [account] = await harness.db
			.select()
			.from(chartOfAccount)
			.where(eq(chartOfAccount.userId, userId));
		expect(account).toMatchObject({
			balance: 150_000,
			openingBalance: 100_000,
			openingDate: '2026-02-03'
		});
		const [item] = await harness.db.select().from(debt).where(eq(debt.userId, userId));
		expect(item).toMatchObject({ kind: 'trade', principalTransactionId: null });
		// Restored books never send the user back through onboarding.
		const [state] = await harness.db
			.select()
			.from(onboardingState)
			.where(eq(onboardingState.userId, userId));
		expect(state.status).toBe('completed');
	});

	it('keeps a free-form category code saved before codes were validated', async () => {
		const userId = await harness.createUser();
		await restoreBackup(
			harness.db,
			userId,
			{
				schemaVersion: '1.0.0',
				businessProfiles: [],
				accounts: [],
				categories: [
					{ id: 'c1', code: 'LAIN-1', name: 'Lain-lain', type: 'expense' },
					{ id: 'c2', code: '9999', name: 'Pendapatan lama', type: 'income' }
				],
				transactions: [],
				debts: [],
				debtPayments: [],
				taxRecords: [],
				templates: [],
				photos: []
			},
			{ decryptNpwp }
		);
		const categories = await harness.db.select().from(category).where(eq(category.userId, userId));
		expect(categories.map((item) => item.code).sort()).toEqual(['9999', 'LAIN-1']);
	});

	it('inserts a large book in statements under D1 parameter limit', async () => {
		const userId = await harness.createUser();
		const transactions = Array.from({ length: 600 }, (_, i) => ({
			id: `t${i}`,
			date: '2026-05-01',
			type: i % 2 ? 'income' : 'expense',
			amount: 1_000 + i,
			accountId: 'a1'
		}));
		const summary = await restoreBackup(harness.db, userId, {
			format: 'buku-umkm-backup',
			schemaVersion: '2.0.0',
			businessProfiles: [],
			accounts: [
				{ id: 'a1', code: '1101', name: 'Kas', type: 'asset', balance: 300, openingBalance: 0 }
			],
			categories: [],
			transactions,
			debts: [],
			debtPayments: [],
			taxProfiles: [],
			taxRecords: [],
			templates: [],
			photos: []
		});
		expect(summary.restored.transactions).toBe(600);
	});
});

describe('restoreBackup refuses a file that reaches outside it', () => {
	type Book = Awaited<ReturnType<typeof seedBooks>>;
	let attacker: string;
	let victim: string;
	let victimBook: Book;
	let victimTransactionId: string;
	let victimDebtId: string;
	let victimPhotoKey: string;
	let file: Record<string, Array<Record<string, unknown>>>;

	beforeAll(async () => {
		victim = await harness.createUser();
		victimBook = await seedBooks(victim);
		victimTransactionId = victimBook.created[0];
		victimDebtId = victimBook.loanId;
		victimPhotoKey = victimBook.photoKey;
		attacker = await harness.createUser();
		await seedBooks(attacker);
		file = await snapshot(attacker);
	});

	const tamper = (edit: (copy: typeof file) => void) => {
		const copy = structuredClone(file);
		edit(copy);
		return copy;
	};

	it.each([
		[
			'a transaction on her account',
			(f: typeof file) => (f.transactions[0].accountId = 'VICTIM_ACCOUNT')
		],
		[
			'a transfer to her account',
			(f: typeof file) => (f.transactions[0].toAccountId = 'VICTIM_ACCOUNT')
		],
		[
			'a transaction in her category',
			(f: typeof file) => (f.transactions[0].categoryId = 'VICTIM_CATEGORY')
		],
		['a transaction on her debt', (f: typeof file) => (f.transactions[0].debtId = 'VICTIM_DEBT')],
		['a payment of her debt', (f: typeof file) => (f.debtPayments[0].debtId = 'VICTIM_DEBT')],
		[
			'a payment through her transaction',
			(f: typeof file) => (f.debtPayments[0].transactionId = 'VICTIM_TRANSACTION')
		],
		[
			'a template in her category',
			(f: typeof file) => (f.templates[0].categoryId = 'VICTIM_CATEGORY')
		],
		[
			'a loan through her account',
			(f: typeof file) => {
				const loan = f.debts.find((item) => item.kind === 'loan')!;
				loan.principalAccountId = 'VICTIM_ACCOUNT';
			}
		],
		[
			'a photo on her transaction',
			(f: typeof file) => (f.photos[0].transactionId = 'VICTIM_TRANSACTION')
		]
	])("rejects %s and changes nobody's data", async (_label, edit) => {
		const victimBefore = await reports(victim);
		const crafted = JSON.parse(
			JSON.stringify(tamper(edit))
				.replaceAll('VICTIM_ACCOUNT', victimBook.kas)
				.replaceAll('VICTIM_CATEGORY', victimBook.sales)
				.replaceAll('VICTIM_DEBT', victimDebtId)
				.replaceAll('VICTIM_TRANSACTION', victimTransactionId)
		);

		await expectRejected(attacker, crafted, /tidak ada di file backup/);
		expect(await reports(victim)).toEqual(victimBefore);
	});

	it("never attaches a photo row to another user's receipt object", async () => {
		const { bucket } = fakeReceipts([victimPhotoKey]);
		const crafted = tamper((f) => {
			f.photos[0].r2Key = victimPhotoKey;
			f.photos[0].r2Url = `/api/photos/${victimPhotoKey}`;
		});

		const summary = await restoreBackup(harness.db, attacker, crafted, {
			receipts: bucket,
			decryptNpwp
		});

		expect(summary.photosDropped).toBe(1);
		const rows = await harness.db
			.select()
			.from(transactionPhoto)
			.where(eq(transactionPhoto.r2Key, victimPhotoKey));
		expect(rows.map((row) => row.userId)).toEqual([victim]);
	});
});

describe('restoreBackup refuses an invalid file and changes nothing', () => {
	let userId: string;
	let file: Record<string, unknown>;

	beforeAll(async () => {
		userId = await harness.createUser();
		await seedBooks(userId);
		file = await snapshot(userId);
	});

	const edited = (edit: (copy: Record<string, Array<Record<string, unknown>>>) => void) => {
		const copy = structuredClone(file) as Record<string, Array<Record<string, unknown>>>;
		edit(copy);
		return copy;
	};

	it.each([
		['a negative amount', (f) => (f.transactions[0].amount = -5_000), /Jumlah harus berupa Rupiah/],
		['a fractional amount', (f) => (f.transactions[0].amount = 1.5), /Jumlah harus berupa Rupiah/],
		['an impossible date', (f) => (f.transactions[0].date = '2026-02-30'), /Tanggal harus berupa/],
		[
			'an unknown transaction type',
			(f) => (f.transactions[0].type = 'transfer'),
			/Jenis transaksi/
		],
		['a balance given as text', (f) => (f.accounts[0].balance = '100'), /Saldo/],
		['an unknown debt status', (f) => (f.debts[0].status = 'lunas'), /Status/],
		['an unknown debt kind', (f) => (f.debts[0].kind = 'gift'), /Jenis catatan/],
		[
			'a trade debt with a principal account',
			(f) => {
				const trade = f.debts.find((item) => item.kind === 'trade')!;
				trade.principalAccountId = f.accounts[0].id;
			},
			/hanya diisi untuk pinjaman/
		],
		['an overlong template name', (f) => (f.templates[0].name = 'x'.repeat(201)), /maksimal 200/],
		['an unknown tax status', (f) => (f.taxRecords[0].status = 'lunas'), /Status pajak/],
		['a duplicate account id', (f) => f.accounts.push({ ...f.accounts[0] }), /ID yang sama/],
		[
			'a missing table',
			(f) => delete (f as Record<string, unknown>).debts,
			/daftar hutang\/piutang/
		],
		['a row that is not an object', (f) => (f.transactions[0] = 'x' as never), /bukan sebuah objek/]
	] as Array<[string, (f: Record<string, Array<Record<string, unknown>>>) => void, RegExp]>)(
		'rejects %s',
		async (_label, edit, message) => {
			await expectRejected(userId, edited(edit), message);
		}
	);

	it.each([
		['no version', (f: Record<string, unknown>) => ({ ...f, schemaVersion: undefined })],
		['a future major version', (f: Record<string, unknown>) => ({ ...f, schemaVersion: '3.0.0' })],
		[
			'a 2.x file without the format marker',
			(f: Record<string, unknown>) => ({ ...f, format: 'x' })
		],
		['a JSON array', () => []]
	])('rejects a file with %s', async (_label, build) => {
		await expectRejected(userId, build(file), /backup/i);
	});

	it('rejects a book over the row limit before touching anything', async () => {
		const categories = Array.from({ length: MAX_RESTORE_ROWS + 1 }, (_, i) => ({
			id: `c${i}`,
			code: '5101',
			name: 'Bahan',
			type: 'expense'
		}));
		const failure = await expectRejected(userId, { ...file, categories }, /terlalu besar/);
		expect(failure.status).toBe(413);
	});
});
