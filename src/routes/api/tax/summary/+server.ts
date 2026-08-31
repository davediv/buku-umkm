import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { calculateMonthlyTax, getThresholdInfo } from '$lib/tax/engine';
import {
	calculateCumulativeRevenue,
	getTaxRecordForMonth,
	getTaxYearContext
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
		// Get current year and month
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1; // 1-12
		const [context, taxRec] = await Promise.all([
			getTaxYearContext(db, userId, currentYear),
			getTaxRecordForMonth(db, userId, currentYear, currentMonth)
		]);
		const taxpayerType = context.eligibility.taxpayerType;
		const calculationAvailable = context.eligibility.status === 'eligible' && taxpayerType !== null;

		// Calculate cumulative revenue up to current month
		const cumulativeRevenue = calculateCumulativeRevenue(
			context.aggregatedMonthlyRevenue,
			currentMonth
		);
		const previousCumulativeRevenue = calculateCumulativeRevenue(
			context.aggregatedMonthlyRevenue,
			currentMonth - 1
		);

		// Calculate current month tax using the engine
		const currentMonthRevenue = context.aggregatedMonthlyRevenue[currentMonth - 1] ?? 0;
		const taxCalculation = calculationAvailable
			? calculateMonthlyTax({
					userId,
					taxpayerType,
					year: currentYear,
					month: currentMonth,
					grossRevenue: currentMonthRevenue,
					previousCumulativeRevenue
				})
			: null;

		// Get tax record status for current month
		const paymentStatus = calculationAvailable ? taxRec?.status || TAX_STATUS.UNPAID : null;

		// Get threshold info
		const thresholdInfo = getThresholdInfo(cumulativeRevenue);

		// Build response
		const response = {
			year: currentYear,
			month: currentMonth,
			currentMonthRevenue,
			recordedCurrentMonthRevenue: context.recordedMonthlyRevenue[currentMonth - 1] ?? 0,
			externalCurrentMonthRevenue: context.externalMonthlyRevenue[currentMonth - 1] ?? 0,
			currentMonthTax: taxCalculation?.taxAmount ?? null,
			cumulativeAnnualRevenue: cumulativeRevenue,
			thresholdPercentage: thresholdInfo.percentage,
			thresholdAmount: thresholdInfo.threshold,
			paymentStatus,
			taxableRevenue: taxCalculation?.taxableRevenue ?? null,
			isBelowThreshold: taxCalculation?.isBelowThreshold ?? null,
			taxpayerType,
			calculationStatus: calculationAvailable ? 'estimate' : 'unavailable',
			profileConfigured: context.profile !== null,
			eligibility: context.eligibility
		};

		return json({ data: response });
	} catch {
		console.error('Error in GET /api/tax/summary:');
		return json({ error: 'Failed to fetch tax summary' }, { status: 500 });
	}
};
