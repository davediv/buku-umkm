import { and, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { SQLiteDb } from '../index';
import { debt, transaction } from '../schema';

/*
 * The books are kept on the accrual basis (SAK EMKM):
 * - revenue and expense are the profit-and-loss transactions below, plus credit sales
 *   (trade piutang) and credit purchases (trade hutang) on the debt's date;
 * - paying or collecting any debt only moves cash, and a loan's principal is never
 *   revenue or expense.
 */

/**
 * Transaction rows that count as revenue or expense. A deleted row (isActive = false)
 * no longer exists for reporting; both legs of an internal transfer (toAccountId set)
 * only move money between the user's own accounts; and a row linked to a debt (debtId
 * set) is a debt payment or a loan's principal, a cash movement whose revenue or expense,
 * if any, was recognised when the debt was recorded.
 */
export function profitAndLossRows(): SQL {
	return and(
		eq(transaction.isActive, true),
		isNull(transaction.toAccountId),
		isNull(transaction.debtId)
	)!;
}

/**
 * Transaction rows that move cash into or out of the business: every active row except
 * internal transfers, which net to zero across the user's accounts. Debt payments and
 * loan principal count here even though they are not revenue or expense.
 */
export function cashMovementRows(): SQL {
	return and(eq(transaction.isActive, true), isNull(transaction.toAccountId))!;
}

/**
 * Debts that are revenue (piutang) or expense (hutang) on their own date: active credit
 * sales and purchases. Loans are excluded.
 */
export function tradeDebtRows(): SQL {
	return and(eq(debt.isActive, true), eq(debt.kind, 'trade'))!;
}

/** Income-statement labels for trade debts, which have no category. */
export const CREDIT_SALES_LABEL = 'Penjualan kredit';
export const CREDIT_PURCHASES_LABEL = 'Pembelian kredit';

/** A reporting period: from `start` (inclusive) to `end` (exclusive), as ISO dates. */
export type DateRange = { start: string; end: string };

export type ProfitAndLoss = { income: number; expense: number; profit: number };

function sumsByRange<K extends string>(
	ranges: Record<K, DateRange>,
	columns: { date: SQLiteColumn; amount: SQLiteColumn; type: SQLiteColumn },
	types: { income: string; expense: string }
) {
	const fields: Record<string, SQL.Aliased<number>> = {};
	for (const [key, range] of Object.entries<DateRange>(ranges)) {
		for (const side of ['income', 'expense'] as const) {
			// Aliased: Drizzle maps D1 batch rows by column name, and these sums share
			// their SQL text.
			fields[`${key}_${side}`] =
				sql<number>`COALESCE(SUM(CASE WHEN ${columns.type} = ${types[side]} AND ${columns.date} >= ${range.start} AND ${columns.date} < ${range.end} THEN ${columns.amount} ELSE 0 END), 0)`.as(
					`${key}_${side}`
				);
		}
	}
	return fields;
}

/**
 * Revenue and expense for each named period, as two statements that can run on their
 * own or inside a larger D1 batch: one over profit-and-loss transactions, one over
 * trade debts. Pass both result sets to `read`.
 */
export function profitAndLossTotals<K extends string>(
	db: SQLiteDb,
	userId: string,
	ranges: Record<K, DateRange>
) {
	const values = Object.values<DateRange>(ranges);
	const start = values.map((range) => range.start).sort()[0];
	const end = values
		.map((range) => range.end)
		.sort()
		.at(-1)!;

	const transactions = db
		.select(
			sumsByRange(
				ranges,
				{ date: transaction.date, amount: transaction.amount, type: transaction.type },
				{ income: 'income', expense: 'expense' }
			)
		)
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				profitAndLossRows(),
				gte(transaction.date, start),
				lt(transaction.date, end)
			)
		);
	const tradeDebts = db
		.select(
			sumsByRange(
				ranges,
				{ date: debt.date, amount: debt.originalAmount, type: debt.type },
				{ income: 'piutang', expense: 'hutang' }
			)
		)
		.from(debt)
		.where(
			and(eq(debt.userId, userId), tradeDebtRows(), gte(debt.date, start), lt(debt.date, end))
		);

	function read(
		transactionRows: Record<string, unknown>[],
		tradeDebtRowsResult: Record<string, unknown>[]
	): Record<K, ProfitAndLoss> {
		const fromTransactions = transactionRows[0] ?? {};
		const fromDebts = tradeDebtRowsResult[0] ?? {};
		const total = (field: string) =>
			Number(fromTransactions[field] ?? 0) + Number(fromDebts[field] ?? 0);
		const result = {} as Record<K, ProfitAndLoss>;
		for (const key of Object.keys(ranges) as K[]) {
			const income = total(`${key}_income`);
			const expense = total(`${key}_expense`);
			result[key] = { income, expense, profit: income - expense };
		}
		return result;
	}

	return { transactions, tradeDebts, read };
}
