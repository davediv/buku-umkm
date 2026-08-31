import { describe, expect, it, vi } from 'vitest';
import type { SQLiteDb } from '$lib/server/db';
import { getRecordedMonthlyRevenue, getTaxYearContext } from './service';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

function aggregateQuery(rows: Promise<unknown[]> | unknown[]) {
	const query = {
		from: vi.fn(),
		where: vi.fn(),
		groupBy: vi.fn().mockReturnValue(rows)
	};
	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	return query;
}

describe('tax revenue loading', () => {
	it('returns twelve monthly totals from one grouped database statement', async () => {
		const query = aggregateQuery([
			{ month: '2026-01', total: 1_250_000 },
			{ month: '2026-08', total: 3_750_000 }
		]);
		const select = vi.fn().mockReturnValue(query);
		const db = { select } as unknown as SQLiteDb;

		const result = await getRecordedMonthlyRevenue(db, 'user-1', 2026);

		expect(select).toHaveBeenCalledOnce();
		expect(query.groupBy).toHaveBeenCalledOnce();
		expect(result).toHaveLength(12);
		expect(result[0]).toBe(1_250_000);
		expect(result[1]).toBe(0);
		expect(result[7]).toBe(3_750_000);
	});

	it('loads the tax profile and monthly totals concurrently', async () => {
		const revenueRows = deferred<unknown[]>();
		const profile = deferred<null>();
		const query = aggregateQuery(revenueRows.promise);
		const select = vi.fn().mockReturnValue(query);
		const findFirst = vi.fn().mockReturnValue(profile.promise);
		const db = {
			select,
			query: { taxProfile: { findFirst } }
		} as unknown as SQLiteDb;

		const contextPromise = getTaxYearContext(db, 'user-1', 2026);

		expect(query.groupBy).toHaveBeenCalledOnce();
		expect(findFirst).toHaveBeenCalledOnce();

		revenueRows.resolve([{ month: '2026-03', total: 900_000 }]);
		profile.resolve(null);
		const context = await contextPromise;

		expect(context.recordedMonthlyRevenue[2]).toBe(900_000);
		expect(context.aggregatedMonthlyRevenue[2]).toBe(900_000);
		expect(context.profile).toBeNull();
		expect(context.eligibility.status).toBe('needs_information');
	});
});
