import { describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import initSqlJs from 'sql.js';
import type { SQLiteDb } from '$lib/server/db';
import {
	getRecordedAnnualExpenseTotal,
	getRecordedMonthlyRevenue,
	getTaxYearContext
} from './service';

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

async function sqliteProxy() {
	const SQL = await initSqlJs();
	const sqlite = new SQL.Database();
	const db = drizzle(async (sql, params, method) => {
		const statement = sqlite.prepare(sql);
		try {
			statement.bind(params);
			if (method === 'run') {
				statement.step();
				return { rows: [] };
			}
			const rows: unknown[][] = [];
			while (statement.step()) rows.push(statement.get());
			return { rows: method === 'get' ? (rows[0] ?? []) : rows };
		} finally {
			statement.free();
		}
	}) as unknown as SQLiteDb;
	return { db, sqlite };
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

	it('executes monthly and annual aggregates with correct date, user, and type boundaries', async () => {
		const { db, sqlite } = await sqliteProxy();
		sqlite.exec(`
			CREATE TABLE "transaction" (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				date TEXT NOT NULL,
				type TEXT NOT NULL,
				amount INTEGER NOT NULL
			)
		`);
		const insertSql =
			'INSERT INTO "transaction" (id, user_id, date, type, amount) VALUES (?, ?, ?, ?, ?)';
		const rows = [
			['jan-1', 'user-1', '2026-01-01', 'income', 100],
			['jan-2', 'user-1', '2026-01-15', 'income', 250],
			['feb-expense', 'user-1', '2026-02-28', 'expense', 900],
			['mar-end', 'user-1', '2026-03-31', 'income', 400],
			['apr-start', 'user-1', '2026-04-01', 'income', 500],
			['dec-income', 'user-1', '2026-12-31', 'income', 600],
			['dec-expense', 'user-1', '2026-12-31', 'expense', 100],
			['next-income', 'user-1', '2027-01-01', 'income', 700],
			['next-expense', 'user-1', '2027-01-01', 'expense', 200],
			['other-income', 'user-2', '2026-12-31', 'income', 800],
			['other-expense', 'user-2', '2026-12-31', 'expense', 300],
			['transfer', 'user-1', '2026-06-01', 'transfer', 1_000]
		] as const;
		for (const row of rows) sqlite.run(insertSql, [...row]);

		try {
			const throughMarch = await getRecordedMonthlyRevenue(db, 'user-1', 2026, 3);
			const fullYear = await getRecordedMonthlyRevenue(db, 'user-1', 2026);
			const expenses = await getRecordedAnnualExpenseTotal(db, 'user-1', 2026);

			expect(throughMarch[0]).toBe(350);
			expect(throughMarch[2]).toBe(400);
			expect(throughMarch[3]).toBe(0);
			expect(throughMarch[11]).toBe(0);
			expect(fullYear[0]).toBe(350);
			expect(fullYear[2]).toBe(400);
			expect(fullYear[3]).toBe(500);
			expect(fullYear[11]).toBe(600);
			expect(expenses).toBe(1_000);
		} finally {
			sqlite.close();
		}
	});
});
