import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SQLiteDb } from '$lib/server/db';
import { transactionQueries } from '$lib/server/db/queries';
import { parseTransactionQuery } from '$lib/transactions/query';
import { getTransactionPage, getTransactionsForExport } from './list';

const db = {} as SQLiteDb;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

function transactionRecord() {
	return {
		id: 'txn-1',
		userId: 'user-1',
		date: '2026-08-20',
		type: 'expense' as const,
		amount: 25_000,
		description: 'Kopi',
		accountId: 'account-1',
		toAccountId: null,
		categoryId: 'category-1',
		debtId: null,
		isTaxed: false,
		taxAmount: 0,
		referenceNumber: null,
		notes: null,
		isActive: true,
		createdAt: new Date('2026-08-20T10:00:00.000Z'),
		updatedAt: new Date('2026-08-20T10:00:00.000Z'),
		account: null,
		category: null,
		toAccount: null
	};
}

afterEach(() => vi.restoreAllMocks());

describe('transaction list service', () => {
	it('counts the filtered dataset and fetches a bounded page concurrently', async () => {
		const countResult = deferred<number>();
		const transactionsResult = deferred<ReturnType<typeof transactionRecord>[]>();
		const count = vi.spyOn(transactionQueries, 'count').mockReturnValue(countResult.promise);
		const findAll = vi
			.spyOn(transactionQueries, 'findAll')
			.mockReturnValue(transactionsResult.promise as never);
		const query = parseTransactionQuery(
			new URLSearchParams(
				'q=kopi&type=expense&range=custom&start=2026-08-01&end=2026-08-30&sort=amount&order=asc&page=3&page_size=25'
			),
			'2026-08-30'
		);

		const resultPromise = getTransactionPage(db, 'user-1', query);

		expect(count).toHaveBeenCalledWith(
			db,
			'user-1',
			expect.objectContaining({
				search: 'kopi',
				type: 'expense',
				startDate: '2026-08-01',
				endDate: '2026-08-30',
				sortBy: 'amount',
				sortOrder: 'asc'
			})
		);
		expect(findAll).toHaveBeenCalledWith(
			db,
			'user-1',
			expect.objectContaining({ limit: 25, offset: 50 })
		);

		countResult.resolve(51);
		transactionsResult.resolve([transactionRecord()]);
		const result = await resultPromise;

		expect(findAll).toHaveBeenCalledOnce();
		expect(result.pagination).toMatchObject({ page: 3, totalPages: 3, total: 51 });
		expect(result.query.page).toBe(3);
	});

	it('clamps an extreme page before issuing its only page query', async () => {
		const countResult = deferred<number>();
		vi.spyOn(transactionQueries, 'count').mockReturnValue(countResult.promise);
		const findAll = vi
			.spyOn(transactionQueries, 'findAll')
			.mockResolvedValue([transactionRecord()] as never);
		const query = parseTransactionQuery(
			new URLSearchParams('range=all&page=1000000&page_size=25'),
			'2026-08-30'
		);

		const resultPromise = getTransactionPage(db, 'user-1', query);
		expect(findAll).not.toHaveBeenCalled();
		countResult.resolve(51);
		const result = await resultPromise;

		expect(findAll).toHaveBeenCalledOnce();
		expect(findAll).toHaveBeenCalledWith(
			db,
			'user-1',
			expect.objectContaining({ limit: 25, offset: 50 })
		);
		expect(result.transactions).toHaveLength(1);
		expect(result.pagination).toMatchObject({ page: 3, totalPages: 3, total: 51 });
	});

	it('refetches a bounded stale page at its clamped offset', async () => {
		vi.spyOn(transactionQueries, 'count').mockResolvedValue(51);
		const findAll = vi
			.spyOn(transactionQueries, 'findAll')
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([transactionRecord()] as never);
		const query = parseTransactionQuery(
			new URLSearchParams('range=all&page=9&page_size=25'),
			'2026-08-30'
		);

		const result = await getTransactionPage(db, 'user-1', query);

		expect(findAll).toHaveBeenNthCalledWith(
			1,
			db,
			'user-1',
			expect.objectContaining({ limit: 25, offset: 200 })
		);
		expect(findAll).toHaveBeenNthCalledWith(
			2,
			db,
			'user-1',
			expect.objectContaining({ limit: 25, offset: 50 })
		);
		expect(result.transactions).toHaveLength(1);
		expect(result.pagination).toMatchObject({ page: 3, totalPages: 3, total: 51 });
	});

	it('uses the same filters for export without list pagination', async () => {
		const findForExport = vi
			.spyOn(transactionQueries, 'findForExport')
			.mockResolvedValue([transactionRecord()] as never);
		const query = parseTransactionQuery(
			new URLSearchParams('q=kopi&type=expense&range=all&page=4&page_size=10'),
			'2026-08-30'
		);

		const result = await getTransactionsForExport(db, 'user-1', query);

		expect(findForExport).toHaveBeenCalledWith(
			db,
			'user-1',
			expect.not.objectContaining({ limit: expect.anything(), offset: expect.anything() })
		);
		expect(result).toHaveLength(1);
	});
});
