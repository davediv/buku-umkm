/**
 * Tax Service - Shared database operations for tax API endpoints
 *
 * Contains reusable functions for fetching tax-related data from the database
 */

import { businessProfile, taxProfile, taxRecord, transaction } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import type { TaxEligibilityDecision, TaxProfileData, TaxpayerType } from './types';
import { REVENUE_THRESHOLD_WP_OP, TAX_TYPE, getIndonesianMonthName } from './config';
import { evaluateTaxEligibility, getTaxpayerTypeForLegalForm } from './eligibility';
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
	userId: string,
	taxYear = new Date().getFullYear()
): Promise<{ npwp: string; taxpayerType: TaxpayerType | null; businessName: string }> {
	const [profile, taxData] = await Promise.all([
		db.select().from(businessProfile).where(eq(businessProfile.userId, userId)).limit(1),
		getTaxProfile(db, userId, taxYear)
	]);
	const encryptedNpwp = profile[0]?.npwp;

	return {
		npwp: encryptedNpwp ? (await decryptNPWP(encryptedNpwp)) || '' : '',
		taxpayerType: taxData ? getTaxpayerTypeForLegalForm(taxData.legalForm) : null,
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
	recordedMonthlyRevenue: number[]
): Promise<TaxYearContext> {
	const profile = await getTaxProfile(db, userId, taxYear);
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
	const recordedMonthlyRevenue = calculateMonthlyRevenues(
		await getYearTransactions(db, userId, year)
	);
	const context = await getTaxYearContext(db, userId, year, recordedMonthlyRevenue);
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
