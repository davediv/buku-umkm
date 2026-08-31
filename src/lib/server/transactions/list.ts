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
	const requestedOffset = (query.page - 1) * query.pageSize;
	const [total, requestedTransactions] = await Promise.all([
		transactionQueries.count(db, userId, filters),
		transactionQueries.findAll(db, userId, {
			...filters,
			limit: query.pageSize,
			offset: requestedOffset
		})
	]);
	const pagination = getTransactionPagination(total, query.page, query.pageSize);
	// Preserve the clamped-page behavior for stale or manually edited URLs. This
	// extra read only occurs when the requested page no longer exists.
	const transactions =
		pagination.offset === requestedOffset
			? requestedTransactions
			: await transactionQueries.findAll(db, userId, {
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
