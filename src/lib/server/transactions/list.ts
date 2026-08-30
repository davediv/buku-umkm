import type { SQLiteDb } from '$lib/server/db';
import { transactionQueries, type TransactionListOptions } from '$lib/server/db/queries';
import { presentTransaction } from '$lib/server/finance/presenters';
import { getTransactionPagination, type TransactionQuery } from '$lib/transactions/query';

function toDatabaseOptions(query: TransactionQuery): TransactionListOptions {
	return {
		type: query.type === 'all' ? undefined : query.type,
		startDate: query.startDate,
		endDate: query.endDate,
		search: query.q || undefined,
		sortBy: query.sortBy,
		sortOrder: query.sortOrder
	};
}

export async function getTransactionPage(db: SQLiteDb, userId: string, query: TransactionQuery) {
	const filters = toDatabaseOptions(query);
	const total = await transactionQueries.count(db, userId, filters);
	const pagination = getTransactionPagination(total, query.page, query.pageSize);
	const transactions = await transactionQueries.findAll(db, userId, {
		...filters,
		limit: pagination.pageSize,
		offset: pagination.offset
	});

	return {
		transactions: transactions.map(presentTransaction),
		query: { ...query, page: pagination.page },
		pagination
	};
}

export async function getTransactionsForExport(
	db: SQLiteDb,
	userId: string,
	query: TransactionQuery
) {
	const transactions = await transactionQueries.findForExport(db, userId, toDatabaseOptions(query));
	return transactions.map(presentTransaction);
}
