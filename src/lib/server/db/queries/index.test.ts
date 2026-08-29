import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SQLiteDb } from '../index';
import { dashboardQueries } from './index';

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
