import type { SQLiteDb } from '#lib/server/db/index.ts';
import { transactionQueries, type TransactionListOptions } from '#lib/server/db/queries/index.ts';
import { presentTransaction } from '#lib/server/finance/presenters.ts';
import { getTransactionPagination, type TransactionQuery } from '#lib/transactions/query.ts';

const MAX_SPECULATIVE_TRANSACTION_OFFSET = 1_000;

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
	let total: number;
	let requestedTransactions: Awaited<ReturnType<typeof transactionQueries.findAll>> | undefined;

	if (requestedOffset <= MAX_SPECULATIVE_TRANSACTION_OFFSET) {
		[total, requestedTransactions] = await Promise.all([
			transactionQueries.count(db, userId, filters),
			transactionQueries.findAll(db, userId, {
				...filters,
				limit: query.pageSize,
				offset: requestedOffset
			})
		]);
	} else {
		// Count first so a manually edited page cannot trigger an unbounded,
		// user-controlled OFFSET scan before pagination is clamped.
		total = await transactionQueries.count(db, userId, filters);
	}

	const pagination = getTransactionPagination(total, query.page, query.pageSize);
	const transactions =
		requestedTransactions !== undefined && requestedOffset === pagination.offset
			? requestedTransactions
			: await transactionQueries.findAll(db, userId, {
					...filters,
					limit: pagination.pageSize,
					offset: pagination.offset
				});

	// Loan-interest rows are corrected by reversing their loan payment, like debt movements.
	const interestDebtIds = await transactionQueries.findInterestDebtIds(
		db,
		userId,
		transactions.map((transaction) => transaction.id)
	);

	return {
		transactions: transactions.map((transaction) => ({
			...presentTransaction(transaction),
			interestDebtId: interestDebtIds.get(transaction.id) ?? null
		})),
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
