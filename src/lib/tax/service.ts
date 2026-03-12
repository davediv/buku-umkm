/**
 * Tax Service - Shared database operations for tax API endpoints
 *
 * Contains reusable functions for fetching tax-related data from the database
 */

import { taxRecord, userExtension, transaction } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import type { TaxpayerType } from './types';
import { TAX_TYPE, TAXPAYER_TYPE, getIndonesianMonthName } from './config';

// Re-export for backward compatibility
export { getIndonesianMonthName };

/**
 * Get taxpayer type for a user
 */
export async function getTaxpayerType(db: SQLiteDb, userId: string): Promise<TaxpayerType> {
	const userExt = await db
		.select()
		.from(userExtension)
		.where(eq(userExtension.id, userId))
		.limit(1);

	return (userExt[0]?.npwpType as TaxpayerType) || TAXPAYER_TYPE.WP_OP;
}

/**
 * Get user extension data (NPWP, business name, etc.)
 */
export async function getUserTaxData(
	db: SQLiteDb,
	userId: string
): Promise<{ npwp: string; taxpayerType: TaxpayerType; businessName: string }> {
	const userExt = await db
		.select()
		.from(userExtension)
		.where(eq(userExtension.id, userId))
		.limit(1);

	return {
		npwp: userExt[0]?.npwp || '',
		taxpayerType: (userExt[0]?.npwpType as TaxpayerType) || TAXPAYER_TYPE.WP_OP,
		businessName: userExt[0]?.businessName || ''
	};
}

/**
 * Get income transactions for a specific year
 */
export async function getYearTransactions(
	db: SQLiteDb,
	userId: string,
	year: number,
	endMonth?: number
): Promise<{ date: string; amount: number }[]> {
	const yearStartDate = `${year}-01-01`;
	const yearEndDate = endMonth
		? `${year}-${endMonth.toString().padStart(2, '0')}-31`
		: `${year}-12-31`;

	return db
		.select({
			date: transaction.date,
			amount: transaction.amount
		})
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.type, 'income'),
				gte(transaction.date, yearStartDate),
				lte(transaction.date, yearEndDate)
			)
		);
}

/**
 * Calculate monthly revenues from transaction list
 */
export function calculateMonthlyRevenues(
	transactions: { date: string; amount: number }[]
): number[] {
	const monthlyAmounts: number[] = Array(12).fill(0);
	for (const t of transactions) {
		const transMonth = parseInt(t.date.substring(5, 7), 10);
		if (transMonth >= 1 && transMonth <= 12) {
			monthlyAmounts[transMonth - 1] += t.amount;
		}
	}
	return monthlyAmounts;
}

/**
 * Calculate cumulative revenue up to a specific month
 */
export function calculateCumulativeRevenue(monthlyAmounts: number[], upToMonth: number): number {
	return monthlyAmounts.slice(0, upToMonth).reduce((sum, rev) => sum + rev, 0);
}

/**
 * Get tax record for a specific month/year
 */
export async function getTaxRecordForMonth(
	db: SQLiteDb,
	userId: string,
	year: number,
	month: number
): Promise<typeof taxRecord.$inferSelect | null> {
	const records = await db
		.select()
		.from(taxRecord)
		.where(
			and(
				eq(taxRecord.userId, userId),
				eq(taxRecord.year, year),
				eq(taxRecord.month, month),
				eq(taxRecord.taxType, TAX_TYPE.PPH_FINAL)
			)
		)
		.limit(1);

	return records[0] || null;
}

/**
 * Get all tax records for a specific year
 */
export async function getTaxRecordsForYear(
	db: SQLiteDb,
	userId: string,
	year: number
): Promise<(typeof taxRecord.$inferSelect)[]> {
	return db
		.select()
		.from(taxRecord)
		.where(
			and(
				eq(taxRecord.userId, userId),
				eq(taxRecord.year, year),
				eq(taxRecord.taxType, TAX_TYPE.PPH_FINAL)
			)
		);
}

/**
 * Format masa pajak (tax period) string
 */
export function formatMasaPajak(month: number, year: number): string {
	return `${month.toString().padStart(2, '0')}-${year}`;
}
