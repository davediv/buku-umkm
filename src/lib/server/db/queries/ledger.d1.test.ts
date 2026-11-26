import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { chartOfAccount } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { getRecordedAnnualExpenseTotal, getRecordedMonthlyRevenue } from '$lib/tax/service';
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
	const record = (type: 'income' | 'expense', amount: number, date: string, accountId = kas) =>
		service.createTransaction(userId, nextKey(), {
			type,
			amount,
			accountId,
			categoryId: null,
			date,
			description: null
		});
	return { userId, kas, bank, service, record };
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
});
