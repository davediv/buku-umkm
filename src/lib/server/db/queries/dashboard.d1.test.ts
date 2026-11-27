import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chartOfAccount } from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { createFinancialMutationService } from '#lib/server/finance/commands.ts';
import { createD1FinanceRepository } from '#lib/server/finance/repository.ts';
import { getBalanceSheetAsOf } from '#lib/server/reports/balance-sheet.ts';
import { todayInJakarta } from '#lib/shared/dates.ts';
import { dashboardQueries } from './index';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

let keyCount = 0;
const nextKey = () => `dashboard-key-${String(++keyCount).padStart(4, '0')}`;

async function setup(openingBalance = 1_000_000) {
	const { db } = harness;
	const userId = await harness.createUser();
	const kas = crypto.randomUUID();
	await db.insert(chartOfAccount).values({
		id: kas,
		userId,
		code: '1001',
		name: 'Kas',
		type: 'asset',
		subType: 'kas',
		balance: openingBalance,
		openingBalance,
		openingDate: '2026-01-01'
	});
	const service = createFinancialMutationService(createD1FinanceRepository(db));
	const createDebt = (
		type: 'piutang' | 'hutang',
		originalAmount: number,
		kind: 'trade' | 'loan' = 'trade'
	) =>
		service.createDebt(userId, nextKey(), {
			type,
			kind,
			accountId: kind === 'loan' ? kas : null,
			contactName: 'Kontak',
			contactPhone: null,
			contactAddress: null,
			originalAmount,
			date: '2026-11-01',
			dueDate: null,
			description: null
		});
	return { userId, kas, service, createDebt };
}

describe('dashboard debt summary on D1', () => {
	it('leaves deleted debts out of outstanding totals and the active count', async () => {
		const { userId, service, createDebt } = await setup();
		await createDebt('piutang', 400_000);
		await createDebt('hutang', 150_000);
		const removed = await createDebt('piutang', 900_000);
		await service.deleteDebt(userId, removed.entity.id);

		const overview = await dashboardQueries.getOverview(harness.db, userId, 'monthly');
		expect(overview.debtSummary).toEqual({ piutang: 400_000, hutang: 150_000 });
		expect(overview.summary.activeDebtsCount).toBe(2);
	});

	it('counts outstanding receivables and payables in net worth like the balance sheet', async () => {
		const { userId, kas, service, createDebt } = await setup(1_000_000);
		const sale = await createDebt('piutang', 400_000);
		await service.recordDebtPayment(userId, sale.entity.id, nextKey(), {
			amount: 100_000,
			date: '2026-11-10',
			accountId: kas,
			notes: null
		});
		await createDebt('hutang', 150_000);
		await createDebt('hutang', 500_000, 'loan');

		const overview = await dashboardQueries.getOverview(harness.db, userId, 'monthly');
		const sheet = await getBalanceSheetAsOf(harness.db, userId, todayInJakarta());
		// Kas 1,6jt + piutang 300rb - hutang 650rb
		expect(overview.summary.netWorth).toBe(1_250_000);
		expect(overview.summary.netWorth).toBe(sheet.equity.total);
		expect(sheet.isBalanced).toBe(true);
	});
});
