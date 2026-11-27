/**
 * Tax Service - Shared database operations for tax API endpoints
 *
 * Contains reusable functions for fetching tax-related data from the database
 */

import {
	businessProfile,
	debt,
	taxProfile,
	taxRecord,
	transaction
} from '#lib/server/db/schema.ts';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { SQLiteDb } from '#lib/server/db/index.ts';
import type { TaxEligibilityDecision, TaxProfileData } from './types';
import { REVENUE_THRESHOLD_WP_OP, TAX_TYPE, getIndonesianMonthName } from './config';
import { evaluateTaxEligibility } from './eligibility';
import { decryptNPWP } from '#lib/server/crypto.ts';
import { calculateMonthlyTax } from './engine';
import { jakartaToday } from './period';
import {
	loanInterestRows,
	profitAndLossRows,
	tradeDebtRows,
	turnoverRows
} from '#lib/server/db/queries/ledger.ts';

// Re-export for backward compatibility
export { getIndonesianMonthName };

/**
 * Get user extension data (NPWP, business name, etc.)
 */
export async function getUserTaxData(
	db: SQLiteDb,
	userId: string
): Promise<{ npwp: string; businessName: string }> {
	const profile = await db
		.select()
		.from(businessProfile)
		.where(eq(businessProfile.userId, userId))
		.limit(1);
	const encryptedNpwp = profile[0]?.npwp;

	return {
		npwp: encryptedNpwp ? (await decryptNPWP(encryptedNpwp)) || '' : '',
		businessName: profile[0]?.name || ''
	};
}

function parseExternalMonthlyRevenue(value: string): number[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? parsed.map((amount) => Number(amount)) : [];
	} catch {
		return [];
	}
}

export async function getTaxProfile(
	db: SQLiteDb,
	userId: string,
	taxYear: number
): Promise<TaxProfileData | null> {
	const row = await db.query.taxProfile.findFirst({
		where: (profiles, { and, eq }) =>
			and(eq(profiles.userId, userId), eq(profiles.taxYear, taxYear))
	});

	if (!row) return null;

	return {
		id: row.id,
		taxYear: row.taxYear,
		legalForm: row.legalForm as TaxProfileData['legalForm'],
		registeredAt: row.registeredAt,
		finalRegimeStartYear: row.finalRegimeStartYear,
		regimeChoice: row.regimeChoice as TaxProfileData['regimeChoice'],
		everUsedGeneralRegime: row.everUsedGeneralRegime,
		turnoverLimitExceeded: row.turnoverLimitExceeded,
		priorYearAggregatedRevenue: row.priorYearAggregatedRevenue,
		externalMonthlyRevenue: parseExternalMonthlyRevenue(row.externalMonthlyRevenue),
		revenueDataComplete: row.revenueDataComplete,
		aggregationConfirmed: row.aggregationConfirmed,
		hasProfessionalServiceIncome: row.hasProfessionalServiceIncome,
		soleOwnerProvidesProfessionalServices: row.soleOwnerProvidesProfessionalServices,
		usesOtherTaxFacility: row.usesOtherTaxFacility,
		groupTurnoverExceeded: row.groupTurnoverExceeded ?? null
	};
}

export async function upsertTaxProfile(
	db: SQLiteDb,
	userId: string,
	data: TaxProfileData
): Promise<TaxProfileData> {
	const values = {
		id: data.id ?? crypto.randomUUID(),
		userId,
		taxYear: data.taxYear,
		legalForm: data.legalForm,
		registeredAt: data.registeredAt,
		finalRegimeStartYear: data.finalRegimeStartYear,
		regimeChoice: data.regimeChoice,
		everUsedGeneralRegime: data.everUsedGeneralRegime,
		turnoverLimitExceeded: data.turnoverLimitExceeded,
		priorYearAggregatedRevenue: data.priorYearAggregatedRevenue,
		externalMonthlyRevenue: JSON.stringify(data.externalMonthlyRevenue),
		revenueDataComplete: data.revenueDataComplete,
		aggregationConfirmed: data.aggregationConfirmed,
		hasProfessionalServiceIncome: data.hasProfessionalServiceIncome,
		soleOwnerProvidesProfessionalServices: data.soleOwnerProvidesProfessionalServices,
		usesOtherTaxFacility: data.usesOtherTaxFacility,
		groupTurnoverExceeded: data.groupTurnoverExceeded,
		updatedAt: new Date()
	};

	await db
		.insert(taxProfile)
		.values(values)
		.onConflictDoUpdate({
			target: [taxProfile.userId, taxProfile.taxYear],
			set: values
		});

	const saved = await getTaxProfile(db, userId, data.taxYear);
	if (!saved) throw new Error('Tax profile was not persisted');
	return saved;
}

const monthOf = (date: SQLiteColumn) => sql<string>`substr(${date}, 1, 7)`;

/**
 * Recorded gross turnover by month, on the accrual basis: profit-and-loss income plus
 * credit sales on their debt date (collecting them later adds nothing). Interest on a
 * loan the business gave is income but not turnover from its usaha (turnoverRows() in
 * ledger.ts), so it is left out. Aggregated in D1 as one statement, since the tax UI
 * only needs 12 totals.
 */
export async function getRecordedMonthlyRevenue(
	db: SQLiteDb,
	userId: string,
	year: number,
	endMonth?: number
): Promise<number[]> {
	const yearStartDate = `${year}-01-01`;
	const lastMonth = endMonth ? Math.min(Math.max(Math.trunc(endMonth), 1), 12) : 12;
	const yearEndDate =
		lastMonth === 12 ? `${year + 1}-01-01` : `${year}-${String(lastMonth + 1).padStart(2, '0')}-01`;
	const sales = db
		.select({
			month: monthOf(transaction.date),
			total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)`
		})
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.type, 'income'),
				turnoverRows(),
				gte(transaction.date, yearStartDate),
				lt(transaction.date, yearEndDate)
			)
		)
		.groupBy(monthOf(transaction.date));
	const creditSales = db
		.select({
			month: monthOf(debt.date),
			total: sql<number>`COALESCE(SUM(${debt.originalAmount}), 0)`
		})
		.from(debt)
		.where(
			and(
				eq(debt.userId, userId),
				eq(debt.type, 'piutang'),
				tradeDebtRows(),
				gte(debt.date, yearStartDate),
				lt(debt.date, yearEndDate)
			)
		)
		.groupBy(monthOf(debt.date));
	const rows = await sales.unionAll(creditSales);

	const monthlyRevenue: number[] = Array(12).fill(0);
	for (const row of rows) {
		const month = Number(row.month.slice(5, 7));
		if (month >= 1 && month <= 12) {
			monthlyRevenue[month - 1] += Number(row.total);
		}
	}
	return monthlyRevenue;
}

/**
 * Interest received on loans the business gave during the year: income in the books that
 * is not PPh Final turnover (see getRecordedMonthlyRevenue), so the annual draft adds it
 * back to show the recorded net income.
 */
export async function getRecordedAnnualLoanInterestIncome(
	db: SQLiteDb,
	userId: string,
	year: number
): Promise<number> {
	const [row] = await db
		.select({ total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)` })
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.type, 'income'),
				profitAndLossRows(),
				loanInterestRows(),
				gte(transaction.date, `${year}-01-01`),
				lt(transaction.date, `${year + 1}-01-01`)
			)
		);
	return Number(row?.total ?? 0);
}

/** Recorded expense for the year: profit-and-loss expense plus credit purchases. */
export async function getRecordedAnnualExpenseTotal(
	db: SQLiteDb,
	userId: string,
	year: number
): Promise<number> {
	const start = `${year}-01-01`;
	const end = `${year + 1}-01-01`;
	const rows = await db
		.select({ total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)` })
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.type, 'expense'),
				profitAndLossRows(),
				gte(transaction.date, start),
				lt(transaction.date, end)
			)
		)
		.unionAll(
			db
				.select({ total: sql<number>`COALESCE(SUM(${debt.originalAmount}), 0)` })
				.from(debt)
				.where(
					and(
						eq(debt.userId, userId),
						eq(debt.type, 'hutang'),
						tradeDebtRows(),
						gte(debt.date, start),
						lt(debt.date, end)
					)
				)
		);
	return rows.reduce((sum, row) => sum + Number(row.total), 0);
}

export interface TaxYearContext {
	profile: TaxProfileData | null;
	eligibility: TaxEligibilityDecision;
	recordedMonthlyRevenue: number[];
	externalMonthlyRevenue: number[];
	aggregatedMonthlyRevenue: number[];
}

export interface TaxDashboardEstimate {
	status: 'estimate' | 'unavailable';
	year: number;
	month: number;
	currentMonthRevenue: number;
	annualRevenue: number;
	currentMonthTax: number | null;
	taxableRevenue: number | null;
	thresholdAmount: number;
	eligibility: TaxEligibilityDecision;
}

export async function getTaxYearContext(
	db: SQLiteDb,
	userId: string,
	taxYear: number,
	endMonth?: number
): Promise<TaxYearContext> {
	const [profile, recordedMonthlyRevenue] = await Promise.all([
		getTaxProfile(db, userId, taxYear),
		getRecordedMonthlyRevenue(db, userId, taxYear, endMonth)
	]);
	const externalMonthlyRevenue =
		profile?.externalMonthlyRevenue.length === 12
			? profile.externalMonthlyRevenue
			: Array(12).fill(0);
	const aggregatedMonthlyRevenue = Array.from(
		{ length: 12 },
		(_, index) => (recordedMonthlyRevenue[index] ?? 0) + (externalMonthlyRevenue[index] ?? 0)
	);
	const currentYearAggregatedRevenue = aggregatedMonthlyRevenue.reduce(
		(sum, amount) => sum + amount,
		0
	);

	return {
		profile,
		eligibility: evaluateTaxEligibility(profile, taxYear, currentYearAggregatedRevenue),
		recordedMonthlyRevenue,
		externalMonthlyRevenue,
		aggregatedMonthlyRevenue
	};
}

export async function getTaxDashboardEstimate(
	db: SQLiteDb,
	userId: string
): Promise<TaxDashboardEstimate> {
	const { year, month } = jakartaToday();
	const context = await getTaxYearContext(db, userId, year);
	const annualRevenue = calculateCumulativeRevenue(context.aggregatedMonthlyRevenue, month);
	const currentMonthRevenue = context.aggregatedMonthlyRevenue[month - 1] ?? 0;
	const taxpayerType = context.eligibility.taxpayerType;

	if (context.eligibility.status !== 'eligible' || !taxpayerType) {
		return {
			status: 'unavailable',
			year,
			month,
			currentMonthRevenue,
			annualRevenue,
			currentMonthTax: null,
			taxableRevenue: null,
			thresholdAmount: REVENUE_THRESHOLD_WP_OP,
			eligibility: context.eligibility
		};
	}

	const calculation = calculateMonthlyTax({
		userId,
		taxpayerType,
		year,
		month,
		grossRevenue: currentMonthRevenue,
		previousCumulativeRevenue: calculateCumulativeRevenue(
			context.aggregatedMonthlyRevenue,
			month - 1
		)
	});

	return {
		status: 'estimate',
		year,
		month,
		currentMonthRevenue,
		annualRevenue,
		currentMonthTax: calculation.taxAmount,
		taxableRevenue: calculation.taxableRevenue,
		thresholdAmount: calculation.thresholdAmount,
		eligibility: context.eligibility
	};
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
