import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { transaction } from '../schema';

/**
 * Transaction rows that count as revenue or expense. A deleted row (isActive = false)
 * no longer exists for reporting, and both legs of an internal transfer (toAccountId
 * set) only move money between the user's own accounts. Neither may reach the income
 * statement or the PPh Final turnover.
 */
export function profitAndLossRows(): SQL {
	return and(eq(transaction.isActive, true), isNull(transaction.toAccountId))!;
}

/**
 * Transaction rows that move cash into or out of the business: every active row except
 * internal transfers, which net to zero across the user's accounts. Debt payments count
 * here even when they are not revenue or expense.
 */
export function cashMovementRows(): SQL {
	return and(eq(transaction.isActive, true), isNull(transaction.toAccountId))!;
}
