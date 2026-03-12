import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transaction } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calculateMonthlyTax, getThresholdInfo } from '$lib/tax/engine';
import {
	calculateMonthlyRevenues,
	calculateCumulativeRevenue,
	getTaxRecordForMonth,
	getTaxpayerType
} from '$lib/tax/service';
import { TAX_STATUS } from '$lib/tax/config';

/**
 * GET /api/tax/summary
 *
 * Returns:
 * - Current month gross revenue
 * - Tax amount
 * - Cumulative annual revenue
 * - Threshold percentage
 * - Payment status
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Get taxpayer type
		const taxpayerType = await getTaxpayerType(db, userId);

		// Get current year and month
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1; // 1-12

		// Get all income transactions for the current year
		const yearStartDate = `${currentYear}-01-01`;
		const yearEndDate = `${currentYear}-12-31`;

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
		const monthlyRevenues = calculateMonthlyRevenues(transactions);

		// Calculate cumulative revenue up to current month
		const cumulativeRevenue = calculateCumulativeRevenue(monthlyRevenues, currentMonth);
		const previousCumulativeRevenue = calculateCumulativeRevenue(monthlyRevenues, currentMonth - 1);

		// Calculate current month tax using the engine
		const currentMonthRevenue = monthlyRevenues[currentMonth - 1];

		const taxCalculation = calculateMonthlyTax({
			userId,
			taxpayerType,
			year: currentYear,
			month: currentMonth,
			grossRevenue: currentMonthRevenue,
			previousCumulativeRevenue
		});

		// Get tax record status for current month
		const taxRec = await getTaxRecordForMonth(db, userId, currentYear, currentMonth);
		const paymentStatus = taxRec?.status || TAX_STATUS.UNPAID;

		// Get threshold info
		const thresholdInfo = getThresholdInfo(cumulativeRevenue);

		// Build response
		const response = {
			year: currentYear,
			month: currentMonth,
			currentMonthRevenue,
			currentMonthTax: taxCalculation.taxAmount,
			cumulativeAnnualRevenue: cumulativeRevenue,
			thresholdPercentage: thresholdInfo.percentage,
			thresholdAmount: thresholdInfo.threshold,
			paymentStatus,
			taxableRevenue: taxCalculation.taxableRevenue,
			isBelowThreshold: taxCalculation.isBelowThreshold,
			taxpayerType
		};

		return json({ data: response });
	} catch (error) {
		console.error('Error in GET /api/tax/summary:', error);
		return json({ error: 'Failed to fetch tax summary' }, { status: 500 });
	}
};
