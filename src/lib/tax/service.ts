/**
 * Tax Service - Shared database operations for tax API endpoints
 *
 * Contains reusable functions for fetching tax-related data from the database
 */

import { businessProfile, taxProfile, taxRecord, transaction } from '$lib/server/db/schema';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import type { TaxEligibilityDecision, TaxProfileData } from './types';
import { REVENUE_THRESHOLD_WP_OP, TAX_TYPE, getIndonesianMonthName } from './config';
import { evaluateTaxEligibility } from './eligibility';
import { decryptNPWP } from '$lib/server/crypto';
import { calculateMonthlyTax } from './engine';
import { todayInJakarta } from '$lib/shared/dates';

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
		priorYearAggregatedRevenue: row.priorYearAggregatedRevenue,
		externalMonthlyRevenue: parseExternalMonthlyRevenue(row.externalMonthlyRevenue),
		revenueDataComplete: row.revenueDataComplete,
		aggregationConfirmed: row.aggregationConfirmed,
		hasProfessionalServiceIncome: row.hasProfessionalServiceIncome,
		soleOwnerProvidesProfessionalServices: row.soleOwnerProvidesProfessionalServices,
		usesOtherTaxFacility: row.usesOtherTaxFacility
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
		priorYearAggregatedRevenue: data.priorYearAggregatedRevenue,
		externalMonthlyRevenue: JSON.stringify(data.externalMonthlyRevenue),
		revenueDataComplete: data.revenueDataComplete,
		aggregationConfirmed: data.aggregationConfirmed,
		hasProfessionalServiceIncome: data.hasProfessionalServiceIncome,
		soleOwnerProvidesProfessionalServices: data.soleOwnerProvidesProfessionalServices,
		usesOtherTaxFacility: data.usesOtherTaxFacility,
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

/**
 * Aggregate recorded income by month in D1. The tax UI only needs 12 totals,
 * so returning every transaction wastes database transfer and Worker CPU.
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
	const monthExpression = sql<string>`substr(${transaction.date}, 1, 7)`;
	const rows = await db
		.select({
			month: monthExpression,
			total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)`
		})
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.type, 'income'),
				gte(transaction.date, yearStartDate),
				lt(transaction.date, yearEndDate)
			)
		)
		.groupBy(monthExpression);

	const monthlyRevenue: number[] = Array(12).fill(0);
	for (const row of rows) {
		const month = Number(row.month.slice(5, 7));
		if (month >= 1 && month <= 12) {
			monthlyRevenue[month - 1] = Number(row.total);
		}
	}
	return monthlyRevenue;
}

export async function getRecordedAnnualExpenseTotal(
	db: SQLiteDb,
	userId: string,
	year: number
): Promise<number> {
	const rows = await db
		.select({ total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)` })
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.type, 'expense'),
				gte(transaction.date, `${year}-01-01`),
				lt(transaction.date, `${year + 1}-01-01`)
			)
		);
	return Number(rows[0]?.total ?? 0);
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
	const [yearPart, monthPart] = todayInJakarta().split('-');
	const year = Number(yearPart);
	const month = Number(monthPart);
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
