import { and, eq, gte, isNull, lt, not, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { SQLiteDb } from '../index';
import { debt, debtPayment, transaction } from '../schema';

/*
 * The books are kept on the accrual basis (SAK EMKM):
 * - revenue and expense are the profit-and-loss transactions below, plus credit sales
 *   (trade piutang) and credit purchases (trade hutang) on the debt's date;
 * - paying or collecting any debt only moves cash, and a loan's principal is never
 *   revenue or expense;
 * - interest paid or received with a loan payment is its own transaction without a debt
 *   link, so it is revenue or expense like any other.
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
 * Transaction rows that book interest on a loan: the interest part of a loan payment
 * (debt_payment.interest_transaction_id). They are profit-and-loss rows.
 */
export function loanInterestRows(): SQL {
	return sql`exists (select 1 from ${debtPayment} where ${and(
		eq(debtPayment.userId, transaction.userId),
		eq(debtPayment.interestTransactionId, transaction.id)
	)})`;
}

/**
 * Transaction rows whose income is gross turnover from the business (peredaran bruto dari
 * usaha) for PPh Final 0,5%: profit-and-loss rows except loan interest. PP 55/2022 Pasal 56
 * (as amended by PP 20/2026) puts the final rate on income from usaha, measured as
 * peredaran bruto; interest on money the business lent is not income from its usaha, so
 * it stays in the income statement but not in the tax base. (Interest the business pays
 * is an expense, which the gross-turnover base never deducts anyway.)
 */
export function turnoverRows(): SQL {
	return and(profitAndLossRows(), not(loanInterestRows()))!;
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

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

function addDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

/** First day of a month; `month` is 1-based and may run past either end of the year. */
function monthStart(year: number, month: number): string {
	return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

/**
 * The period that contains `today` (an ISO date in Asia/Jakarta, see todayInJakarta)
 * and the one before it. Weeks run Monday to Sunday.
 */
export function reportPeriodRanges(
	period: ReportPeriod,
	today: string
): { current: DateRange; previous: DateRange } {
	const [year, month] = today.split('-').map(Number);
	switch (period) {
		case 'daily':
			return {
				current: { start: today, end: addDays(today, 1) },
				previous: { start: addDays(today, -1), end: today }
			};
		case 'weekly': {
			const daysSinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
			const monday = addDays(today, -daysSinceMonday);
			return {
				current: { start: monday, end: addDays(monday, 7) },
				previous: { start: addDays(monday, -7), end: monday }
			};
		}
		case 'monthly':
			return {
				current: { start: monthStart(year, month), end: monthStart(year, month + 1) },
				previous: { start: monthStart(year, month - 1), end: monthStart(year, month) }
			};
		case 'quarterly': {
			const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
			return {
				current: { start: monthStart(year, firstMonth), end: monthStart(year, firstMonth + 3) },
				previous: { start: monthStart(year, firstMonth - 3), end: monthStart(year, firstMonth) }
			};
		}
		case 'yearly':
			return {
				current: { start: monthStart(year, 1), end: monthStart(year + 1, 1) },
				previous: { start: monthStart(year - 1, 1), end: monthStart(year, 1) }
			};
	}
}

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
