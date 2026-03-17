import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transaction } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calculateAnnualTax, getThresholdInfo } from '$lib/tax/engine';
import { calculateMonthlyRevenues, getTaxRecordsForYear, getTaxpayerType } from '$lib/tax/service';
import { TAX_STATUS } from '$lib/tax/config';

/**
 * GET /api/tax/history
 *
 * Query params:
 * - year: year to fetch history for (default: current year)
 *
 * Returns monthly tax records for selected year
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Parse year from query params, default to current year
		const yearParam = url.searchParams.get('year');
		const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

		// Validate year
		if (isNaN(year) || year < 2000 || year > 2100) {
			return json({ error: 'Invalid year parameter' }, { status: 400 });
		}

		// Get taxpayer type
		const taxpayerType = await getTaxpayerType(db, userId);

		// Get all income transactions for the specified year
		const yearStartDate = `${year}-01-01`;
		const yearEndDate = `${year}-12-31`;

		const transactions = await db
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

		// Calculate monthly revenues
		const monthlyAmounts = calculateMonthlyRevenues(transactions);
		const monthlyRevenues = monthlyAmounts.map((revenue, index) => ({
			month: index + 1,
			revenue
		}));

		// Calculate annual tax using the engine
		const annualTax = calculateAnnualTax(monthlyRevenues, taxpayerType, year);

		// Get existing tax records for this year
		const existingRecords = await getTaxRecordsForYear(db, userId, year);

		// Create a map of existing records by month
		const recordsByMonth = new Map<number, (typeof existingRecords)[0]>();
		for (const rec of existingRecords) {
			if (rec.month) {
				recordsByMonth.set(rec.month, rec);
			}
		}

		// Build monthly breakdown
		const monthlyRecords = annualTax.months.map((calc) => {
			const existingRecord = recordsByMonth.get(calc.month);

			return {
				year: calc.year,
				month: calc.month,
				grossRevenue: calc.grossRevenue,
				taxableRevenue: calc.taxableRevenue,
				taxAmount: calc.taxAmount,
				taxRate: calc.taxRate,
				status:
					existingRecord?.status || (calc.taxAmount > 0 ? TAX_STATUS.UNPAID : TAX_STATUS.UNPAID),
				paymentDate: existingRecord?.paymentDate || null,
				billingCode: existingRecord?.billingCode || null,
				isBelowThreshold: calc.isBelowThreshold,
				cumulativeRevenue: calc.cumulativeRevenue,
				thresholdPercentage: calc.thresholdPercentage
			};
		});

		// Calculate totals
		const totalGrossRevenue = monthlyRecords.reduce((sum, r) => sum + r.grossRevenue, 0);
		const totalTaxableRevenue = monthlyRecords.reduce((sum, r) => sum + r.taxableRevenue, 0);
		const totalTaxAmount = monthlyRecords.reduce((sum, r) => sum + r.taxAmount, 0);
		const paidMonths = monthlyRecords.filter((r) => r.status === TAX_STATUS.PAID).length;
		const unpaidMonths = monthlyRecords.filter(
			(r) => r.status === TAX_STATUS.UNPAID && r.taxAmount > 0
		).length;

		// Get threshold info
		const finalCumulativeRevenue =
			annualTax.months[annualTax.months.length - 1]?.cumulativeRevenue || 0;
		const thresholdInfo = getThresholdInfo(finalCumulativeRevenue);

		const response = {
			year,
			taxpayerType,
			totalGrossRevenue,
			totalTaxableRevenue,
			totalTaxAmount,
			thresholdInfo: {
				threshold: thresholdInfo.threshold,
				currentRevenue: finalCumulativeRevenue,
				percentage: thresholdInfo.percentage,
				isExceeded: thresholdInfo.isExceeded,
				thresholdExceededMonth: annualTax.thresholdExceededMonth
			},
			summary: {
				totalMonths: 12,
				monthsWithTax: monthlyRecords.filter((r) => r.taxAmount > 0).length,
				paidMonths,
				unpaidMonths
			},
			months: monthlyRecords
		};

		return json({ data: response });
	} catch {
		console.error('Error in GET /api/tax/history:');
		return json({ error: 'Failed to fetch tax history' }, { status: 500 });
	}
};
