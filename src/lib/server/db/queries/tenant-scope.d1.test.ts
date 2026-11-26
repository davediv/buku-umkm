import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { category, chartOfAccount, debt, debtPayment, transaction } from '$lib/server/db/schema';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { getBalanceSheetAsOf } from '$lib/server/reports/balance-sheet';
import { createTestD1 } from '$lib/server/testing/d1';
import { todayInJakarta } from '$lib/shared/dates';
import { dashboardQueries, debtQueries, transactionQueries } from './index';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

/**
 * User A owns an account, a category and a debt. User B owns rows whose foreign keys point
 * at A's rows, which the app never writes but a bug or a bad restore could.
 */
async function crossTenantRows() {
	const { db } = harness;
	const [ownerA, ownerB] = [await harness.createUser(), await harness.createUser()];
	const [accountA, categoryA, debtA] = [crypto.randomUUID(), crypto.randomUUID(), 'debt-a'];
	const today = todayInJakarta();
	await db.insert(chartOfAccount).values({
		id: accountA,
		userId: ownerA,
		code: '1001',
		name: 'Kas A',
		type: 'asset',
		subType: 'kas',
		openingDate: '2026-01-01'
	});
	await db.insert(category).values({
		id: categoryA,
		userId: ownerA,
		code: '4001',
		name: 'Penjualan A',
		type: 'income'
	});
	await db.insert(debt).values({
		id: `${debtA}-${ownerA}`,
		userId: ownerA,
		type: 'piutang',
		contactName: 'Pelanggan A',
		originalAmount: 100_000,
		remainingAmount: 100_000,
		date: '2026-01-05'
	});
	const ownTransaction = crypto.randomUUID();
	const foreignTransaction = crypto.randomUUID();
	await db.insert(transaction).values([
		{
			id: ownTransaction,
			userId: ownerA,
			date: today,
			type: 'income',
			amount: 1_000,
			accountId: accountA,
			categoryId: categoryA
		},
		{
			id: foreignTransaction,
			userId: ownerB,
			date: today,
			type: 'income',
			amount: 2_000,
			accountId: accountA,
			toAccountId: null,
			categoryId: categoryA
		}
	]);
	await db.insert(debtPayment).values({
		id: crypto.randomUUID(),
		debtId: `${debtA}-${ownerA}`,
		userId: ownerB,
		amount: 50_000,
		date: '2026-01-10',
		accountId: accountA
	});
	return { ownerA, ownerB, debtId: `${debtA}-${ownerA}`, ownTransaction, foreignTransaction };
}

describe('relation loads are scoped to the owner on D1', () => {
	it("never attach another user's account or category to a transaction", async () => {
		const { ownerA, ownerB, ownTransaction, foreignTransaction } = await crossTenantRows();
		const { db } = harness;

		// Control: the owner's own row still loads its relations.
		expect(await transactionQueries.findById(db, ownerA, ownTransaction)).toMatchObject({
			account: { name: 'Kas A' },
			category: { name: 'Penjualan A' }
		});

		const viaQueries = await transactionQueries.findById(db, ownerB, foreignTransaction);
		expect(viaQueries).toMatchObject({ account: null, category: null, toAccount: null });
		const listed = await transactionQueries.findAll(db, ownerB);
		expect(listed.map((item) => [item.account, item.category])).toEqual([[null, null]]);
		const viaRepository = await createD1FinanceRepository(db).findTransaction(
			ownerB,
			foreignTransaction
		);
		expect(viaRepository).toMatchObject({ account: null, category: null });

		const lines = await dashboardQueries.getProfitLossByCategory(db, ownerB, 'daily');
		expect(lines.income).toEqual([expect.objectContaining({ categoryName: 'Tanpa Kategori' })]);
	});

	it("never attach another user's payments to a debt", async () => {
		const { ownerA, debtId } = await crossTenantRows();
		const { db } = harness;

		expect((await debtQueries.findById(db, ownerA, debtId))?.payments).toEqual([]);
		const [listed] = await debtQueries.findAll(db, ownerA);
		expect(listed.payments).toEqual([]);
		expect((await createD1FinanceRepository(db).findDebt(ownerA, debtId))?.payments).toEqual([]);
		const sheet = await getBalanceSheetAsOf(db, ownerA, '2026-01-31');
		expect(sheet.assets.breakdown.piutangDetail.items).toMatchObject([
			{ id: debtId, paidAmount: 0, remainingAmount: 100_000 }
		]);
	});

	it("counts only the category owner's transactions when checking a category", async () => {
		const { db } = harness;
		const owner = await harness.createUser();
		const other = await harness.createUser();
		const [categoryId, accountId] = [crypto.randomUUID(), crypto.randomUUID()];
		await db.insert(category).values({
			id: categoryId,
			userId: owner,
			code: '4001',
			name: 'Jasa',
			type: 'income'
		});
		await db.insert(chartOfAccount).values({
			id: accountId,
			userId: other,
			code: '1001',
			name: 'Kas',
			type: 'asset',
			subType: 'kas'
		});
		await db.insert(transaction).values({
			id: crypto.randomUUID(),
			userId: other,
			date: '2026-01-10',
			type: 'income',
			amount: 1_000,
			accountId,
			categoryId
		});

		expect(await transactionQueries.hasTransactionsByCategory(db, categoryId)).toBe(false);
	});
});
