import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SQLiteDb } from '$lib/server/db';
import { transactionQueries } from '$lib/server/db/queries';
import { parseTransactionQuery } from '$lib/transactions/query';
import { getTransactionPage, getTransactionsForExport } from './list';

const db = {} as SQLiteDb;

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
	it('counts the full filtered dataset before fetching the requested page', async () => {
		const count = vi.spyOn(transactionQueries, 'count').mockResolvedValue(51);
		const findAll = vi
			.spyOn(transactionQueries, 'findAll')
			.mockResolvedValue([transactionRecord()] as never);
		const query = parseTransactionQuery(
			new URLSearchParams(
				'q=kopi&type=expense&range=custom&start=2026-08-01&end=2026-08-30&sort=amount&order=asc&page=9&page_size=25'
			),
			'2026-08-30'
		);

		const result = await getTransactionPage(db, 'user-1', query);

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
		expect(result.pagination).toMatchObject({ page: 3, totalPages: 3, total: 51 });
		expect(result.query.page).toBe(3);
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
