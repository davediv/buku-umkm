import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { chartOfAccount } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { getBalanceSheetAsOf } from '$lib/server/reports/balance-sheet';
import {
	getRecordedAnnualExpenseTotal,
	getRecordedAnnualLoanInterestIncome,
	getRecordedMonthlyRevenue
} from '$lib/tax/service';
import { dashboardQueries, transactionQueries } from './index';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

let keyCount = 0;
const nextKey = () => `ledger-key-${String(++keyCount).padStart(4, '0')}`;

async function setup() {
	const { db } = harness;
	const userId = await harness.createUser();
	const [kas, bank] = [crypto.randomUUID(), crypto.randomUUID()];
	await db.insert(chartOfAccount).values([
		{
			id: kas,
			userId,
			code: '1001',
			name: 'Kas',
			type: 'asset',
			subType: 'kas',
			balance: 50_000_000,
			openingBalance: 50_000_000,
			openingDate: '2024-01-01'
		},
		{
			id: bank,
			userId,
			code: '1002',
			name: 'Bank',
			type: 'asset',
			subType: 'bank',
			balance: 0,
			openingBalance: 0,
			openingDate: '2024-01-01'
		}
	]);
	const service = createFinancialMutationService(createD1FinanceRepository(db));
	const createDebt = (
		type: 'piutang' | 'hutang',
		kind: 'trade' | 'loan',
		amount: number,
		date: string,
		contactName = 'Kontak'
	) =>
		service.createDebt(userId, nextKey(), {
			type,
			kind,
			accountId: kind === 'loan' ? kas : null,
			contactName,
			contactPhone: null,
			contactAddress: null,
			originalAmount: amount,
			date,
			dueDate: null,
			description: null
		});
	const pay = (debtId: string, amount: number, date: string, interestAmount = 0) =>
		service.recordDebtPayment(userId, debtId, nextKey(), {
			amount,
			interestAmount,
			date,
			accountId: kas,
			notes: null
		});
	const record = (type: 'income' | 'expense', amount: number, date: string, accountId = kas) =>
		service.createTransaction(userId, nextKey(), {
			type,
			amount,
			accountId,
			categoryId: null,
			date,
			description: null
		});
	return { userId, kas, bank, service, record, createDebt, pay };
}

/**
 * One user's books around new year 2026: operating income and expenses at month and year
 * boundaries, a deleted sale and a Kas→Bank transfer on 2025-12-15 and on 2026-01-01, plus
 * another user's sales on the same days.
 */
async function seedYear() {
	const books = await setup();
	const { userId, kas, bank, service, record } = books;
	await record('income', 100, '2025-01-01');
	await record('income', 250, '2025-01-15');
	await record('expense', 900, '2025-02-28');
	await record('income', 400, '2025-03-31');
	await record('income', 500, '2025-04-01');
	await record('income', 600, '2025-12-31');
	await record('expense', 100, '2025-12-31');
	await record('income', 700, '2026-01-01');
	await record('expense', 200, '2026-01-01');

	for (const date of ['2025-12-15', '2026-01-01']) {
		const deleted = await record('income', 5_000, date);
		await service.deleteTransaction(userId, deleted.entity.id);
		await service.createTransfer(userId, nextKey(), {
			amount: 20_000_000,
			sourceAccountId: kas,
			destinationAccountId: bank,
			date,
			description: null
		});
	}

	const other = await setup();
	await other.record('income', 800, '2025-12-31');
	await other.record('income', 800, '2026-01-01');
	return books;
}

describe('profit-and-loss totals on D1', () => {
	it('counts neither deleted rows nor transfer legs as revenue or expense for tax', async () => {
		const { userId } = await seedYear();

		const throughMarch = await getRecordedMonthlyRevenue(harness.db, userId, 2025, 3);
		const fullYear = await getRecordedMonthlyRevenue(harness.db, userId, 2025);
		const expenses = await getRecordedAnnualExpenseTotal(harness.db, userId, 2025);

		expect(throughMarch).toEqual([350, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(fullYear).toEqual([350, 0, 400, 500, 0, 0, 0, 0, 0, 0, 0, 600]);
		expect(expenses).toBe(1_000);
	});

	describe('dashboard and income statement', () => {
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date(2026, 0, 1, 12));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('report the same operating totals as the tax view', async () => {
			const { userId } = await seedYear();
			const { db } = harness;

			const overview = await dashboardQueries.getOverview(db, userId, 'monthly');
			expect(overview.summary).toMatchObject({
				monthlyIncome: 700,
				monthlyExpense: 200,
				yearToDateRevenue: 700,
				yearToDateExpense: 200
			});
			expect(overview.todayStats).toEqual({ income: 700, expense: 200, profit: 500 });

			const cashFlow = await dashboardQueries.getCashFlow(db, userId, 2);
			expect(cashFlow).toMatchObject([
				{ label: '2025-12', income: 600, expense: 100 },
				{ label: '2026-01', income: 700, expense: 200 }
			]);

			const byCategory = await dashboardQueries.getProfitLossByCategory(db, userId, 'monthly');
			expect(byCategory.income.reduce((sum, row) => sum + row.total, 0)).toBe(700);
			expect(byCategory.expense.reduce((sum, row) => sum + row.total, 0)).toBe(200);

			const comparison = await dashboardQueries.getPreviousPeriodStats(db, userId, 'yearly');
			expect(comparison).toEqual({
				current: { income: 700, expense: 200, profit: 500 },
				previous: { income: 1_850, expense: 1_000, profit: 850 }
			});
			// "Hari ini" is today against yesterday, matching the daily category lines.
			const daily = await dashboardQueries.getPreviousPeriodStats(db, userId, 'daily');
			expect(daily).toEqual({
				current: { income: 700, expense: 200, profit: 500 },
				previous: { income: 600, expense: 100, profit: 500 }
			});
		});
	});

	it('lists only active transactions as recent', async () => {
		const { userId, record, service } = await setup();
		const kept = await record('income', 1_000, '2025-05-01');
		const removed = await record('income', 2_000, '2025-05-02');
		await service.deleteTransaction(userId, removed.entity.id);

		const recent = await transactionQueries.getRecent(harness.db, userId, 5);
		expect(recent.map((item) => item.id)).toEqual([kept.entity.id]);
	});

	describe('on the accrual basis', () => {
		/**
		 * March 2025: a cash sale, a credit sale and a credit purchase (both settled later),
		 * a loan given and a loan received, and a credit sale deleted before any payment.
		 */
		async function seedDebts() {
			const books = await setup();
			const { userId, record, createDebt, pay, service } = books;
			await record('income', 100, '2025-03-01');
			const creditSale = await createDebt('piutang', 'trade', 1_000_000, '2025-03-10', 'Budi');
			await pay(creditSale.entity.id, 400_000, '2025-04-05');
			const creditPurchase = await createDebt('hutang', 'trade', 300_000, '2025-03-12');
			await pay(creditPurchase.entity.id, 300_000, '2025-05-01');
			const lent = await createDebt('piutang', 'loan', 2_000_000, '2025-03-15', 'Citra');
			await pay(lent.entity.id, 500_000, '2025-06-01');
			await createDebt('hutang', 'loan', 5_000_000, '2025-03-20', 'Koperasi');
			const removed = await createDebt('piutang', 'trade', 777, '2025-03-01');
			await service.deleteDebt(userId, removed.entity.id);
			return books;
		}

		it('counts credit sales as turnover on the debt date and never payments or loans', async () => {
			const { userId } = await seedDebts();

			const revenue = await getRecordedMonthlyRevenue(harness.db, userId, 2025);
			expect(revenue.slice(2, 6)).toEqual([1_000_100, 0, 0, 0]);
			expect(await getRecordedAnnualExpenseTotal(harness.db, userId, 2025)).toBe(300_000);
		});

		it('keeps the balance sheet balanced with credit sales and loans', async () => {
			const { userId } = await seedDebts();

			const sheet = await getBalanceSheetAsOf(harness.db, userId, '2025-12-31');
			// Kas: 50jt + 100 + 400rb - 300rb - 2jt + 500rb + 5jt
			expect(sheet.assets.breakdown.kas.items[0].balance).toBe(53_600_100);
			expect(sheet.assets.breakdown.piutangDetail.subtotal).toBe(600_000 + 1_500_000);
			expect(sheet.liabilities.total).toBe(5_000_000);
			expect(sheet.equity.components).toEqual([
				{ name: 'Modal dari saldo awal', amount: 50_000_000 },
				{ name: 'Akumulasi hasil usaha', amount: 700_100 }
			]);
			expect(sheet.isBalanced).toBe(true);
		});

		describe('in the income statement and dashboard', () => {
			beforeEach(() => {
				vi.useFakeTimers({ toFake: ['Date'] });
			});

			afterEach(() => {
				vi.useRealTimers();
			});

			it('show credit sales and purchases as their own lines', async () => {
				vi.setSystemTime(new Date(2025, 2, 31, 12));
				const { userId } = await seedDebts();
				const { db } = harness;

				const lines = await dashboardQueries.getProfitLossByCategory(db, userId, 'monthly');
				expect(lines.income).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ categoryName: 'Tanpa Kategori', total: 100 }),
						expect.objectContaining({ categoryName: 'Penjualan kredit', total: 1_000_000 })
					])
				);
				expect(lines.expense).toEqual([
					expect.objectContaining({ categoryName: 'Pembelian kredit', total: 300_000 })
				]);

				const overview = await dashboardQueries.getOverview(db, userId, 'monthly');
				expect(overview.periodStats).toMatchObject({ income: 1_000_100, expense: 300_000 });
				const comparison = await dashboardQueries.getPreviousPeriodStats(db, userId, 'monthly');
				expect(comparison.current).toEqual({
					income: 1_000_100,
					expense: 300_000,
					profit: 700_100
				});
			});

			it('chart payments and loan principal as cash flow', async () => {
				vi.setSystemTime(new Date(2025, 5, 30, 12));
				const { userId } = await seedDebts();

				const cashFlow = await dashboardQueries.getCashFlow(harness.db, userId, 4);
				expect(cashFlow).toMatchObject([
					{ label: '2025-03', income: 100 + 5_000_000, expense: 2_000_000 },
					{ label: '2025-04', income: 400_000, expense: 0 },
					{ label: '2025-05', income: 0, expense: 300_000 },
					{ label: '2025-06', income: 500_000, expense: 0 }
				]);
			});
		});
	});

	describe('loan interest', () => {
		/**
		 * April 2025: a cash sale, a payment on a loan received (principal and interest) and
		 * one on a loan given; in May, interest alone on the loan given.
		 */
		async function seedInterest() {
			const books = await setup();
			const { record, createDebt, pay } = books;
			const received = await createDebt('hutang', 'loan', 5_000_000, '2025-03-20', 'Koperasi');
			const given = await createDebt('piutang', 'loan', 2_000_000, '2025-03-15', 'Citra');
			await record('income', 100, '2025-04-01');
			const paid = await pay(received.entity.id, 500_000, '2025-04-10', 50_000);
			await pay(given.entity.id, 300_000, '2025-04-12', 30_000);
			await pay(given.entity.id, 0, '2025-05-12', 20_000);
			return { ...books, receivedId: received.entity.id, paid: paid.entity };
		}

		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date(2025, 3, 30, 12));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('books interest expense and income in the income statement', async () => {
			const { userId } = await seedInterest();
			const { db } = harness;

			const lines = await dashboardQueries.getProfitLossByCategory(db, userId, 'monthly');
			expect(lines.income).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ categoryName: 'Tanpa Kategori', total: 100 }),
					expect.objectContaining({
						categoryCode: '4901',
						categoryName: 'Pendapatan Bunga',
						total: 30_000
					})
				])
			);
			expect(lines.expense).toEqual([
				expect.objectContaining({
					categoryCode: '7101',
					categoryName: 'Beban Bunga',
					total: 50_000
				})
			]);
			const overview = await dashboardQueries.getOverview(db, userId, 'monthly');
			expect(overview.periodStats).toMatchObject({ income: 30_100, expense: 50_000 });
			expect(overview.summary).toMatchObject({ yearToDateRevenue: 50_100 });
		});

		it('keeps interest on a loan given out of PPh Final turnover', async () => {
			const { userId } = await seedInterest();
			const { db } = harness;

			const revenue = await getRecordedMonthlyRevenue(db, userId, 2025);
			expect(revenue.slice(2, 5)).toEqual([0, 100, 0]);
			expect(await getRecordedAnnualLoanInterestIncome(db, userId, 2025)).toBe(50_000);
			// Interest paid is an expense like any other.
			expect(await getRecordedAnnualExpenseTotal(db, userId, 2025)).toBe(50_000);
		});

		it('links the interest transaction back to its loan, and nothing else', async () => {
			const { userId, receivedId, paid } = await seedInterest();
			const { db } = harness;

			expect(
				await transactionQueries.findInterestDebtId(db, userId, paid.interestTransaction!.id)
			).toBe(receivedId);
			expect(await transactionQueries.findInterestDebtId(db, userId, paid.transaction!.id)).toBe(
				null
			);
			const other = await setup();
			expect(
				await transactionQueries.findInterestDebtId(db, other.userId, paid.interestTransaction!.id)
			).toBe(null);
		});

		it('keeps the balance sheet balanced', async () => {
			const { userId } = await seedInterest();

			const sheet = await getBalanceSheetAsOf(harness.db, userId, '2025-12-31');
			// Kas: 50jt + 5jt - 2jt + 100 - 550rb + 330rb + 20rb
			expect(sheet.assets.breakdown.kas.items[0].balance).toBe(52_800_100);
			expect(sheet.assets.breakdown.piutangDetail.subtotal).toBe(1_700_000);
			expect(sheet.liabilities.total).toBe(4_500_000);
			expect(sheet.equity.components).toEqual([
				{ name: 'Modal dari saldo awal', amount: 50_000_000 },
				{ name: 'Akumulasi hasil usaha', amount: 100 + 50_000 - 50_000 }
			]);
			expect(sheet.isBalanced).toBe(true);
		});
	});
});
