import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SQLiteDb } from '../index';
import { dashboardQueries, debtQueries } from './index';

describe('debtQueries list projections', () => {
	it('omits payment relations from summary lists while preserving the full-list contract', async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const db = { query: { debt: { findMany } } } as unknown as SQLiteDb;

		await debtQueries.findAllSummaries(db, 'user-1');
		expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty('with');

		await debtQueries.findAll(db, 'user-1');
		expect(findMany.mock.calls[1]?.[0]).toMatchObject({ with: { payments: true } });
	});
});

describe('dashboardQueries.getCashFlow', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 7, 29, 12));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('loads every month with one grouped database statement', async () => {
		const rows = [
			{ label: '2026-03', type: 'income', total: 5_000_000 },
			{ label: '2026-03', type: 'expense', total: 2_000_000 },
			{ label: '2026-08', type: 'expense', total: 750_000 }
		];
		const query = {
			from: vi.fn(),
			where: vi.fn(),
			groupBy: vi.fn().mockResolvedValue(rows)
		};
		query.from.mockReturnValue(query);
		query.where.mockReturnValue(query);
		const select = vi.fn().mockReturnValue(query);
		const db = { select } as unknown as SQLiteDb;

		const result = await dashboardQueries.getCashFlow(db, 'user-1', 6);

		expect(select).toHaveBeenCalledTimes(1);
		expect(query.groupBy).toHaveBeenCalledTimes(1);
		expect(result).toHaveLength(6);
		expect(result[0]).toMatchObject({
			label: '2026-03',
			income: 5_000_000,
			expense: 2_000_000,
			net: 3_000_000
		});
		expect(result[4]).toMatchObject({ label: '2026-07', income: 0, expense: 0, net: 0 });
		expect(result[5]).toMatchObject({
			label: '2026-08',
			income: 0,
			expense: 750_000,
			net: -750_000
		});
	});
});

describe('dashboardQueries.getOverview', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 7, 29, 12));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('loads all shared dashboard aggregates with four database statements', async () => {
		const resultSets = [
			[{ assets: 12_000_000, liabilities: 2_000_000, equity: 10_000_000 }],
			[
				{
					monthlyIncome: 8_000_000,
					monthlyExpense: 3_000_000,
					yearIncome: 60_000_000,
					yearExpense: 25_000_000,
					todayIncome: 500_000,
					todayExpense: 100_000,
					periodIncome: 2_000_000,
					periodExpense: 750_000
				}
			],
			[{ piutang: 4_000_000, hutang: 1_500_000, activeCount: 3 }],
			[{ count: 2 }]
		];
		const select = vi.fn();
		for (const rows of resultSets) {
			const query = { from: vi.fn(), where: vi.fn().mockResolvedValue(rows) };
			query.from.mockReturnValue(query);
			select.mockReturnValueOnce(query);
		}
		const db = { select } as unknown as SQLiteDb;

		const result = await dashboardQueries.getOverview(db, 'user-1', 'weekly');

		expect(select).toHaveBeenCalledTimes(4);
		expect(result.summary).toMatchObject({
			netWorth: 10_000_000,
			monthlyProfit: 5_000_000,
			yearToDateProfit: 35_000_000,
			activeDebtsCount: 3,
			unpaidTaxesCount: 2
		});
		expect(result.periodStats).toMatchObject({
			period: 'weekly',
			income: 2_000_000,
			expense: 750_000,
			profit: 1_250_000
		});
		expect(result.todayStats).toEqual({ income: 500_000, expense: 100_000, profit: 400_000 });
		expect(result.debtSummary).toEqual({ piutang: 4_000_000, hutang: 1_500_000 });
	});
});
