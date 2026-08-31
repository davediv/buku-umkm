import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { calculateMonthlyTax } from '$lib/tax/engine';
import {
	getRecordedAnnualExpenseTotal,
	getTaxRecordsForYear,
	getTaxYearContext
} from '$lib/tax/service';
import { REVENUE_THRESHOLD_WP_OP, TAX_STATUS, TAXPAYER_TYPE } from '$lib/tax/config';
import { INDONESIAN_MONTHS } from '$lib/tax/config';

/**
 * GET /api/tax/annual?year=2024
 *
 * Returns SPT Tahunan (Annual Tax Return) data for a specific year
 * - Monthly gross revenue
 * - Monthly PPh Final paid
 * - Annual totals
 * - Net income (from profit/loss)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	// Get year from query param, default to current year
	const year = url.searchParams.get('year')
		? parseInt(url.searchParams.get('year')!)
		: new Date().getFullYear();

	if (isNaN(year) || year < 2000 || year > 2100) {
		return json({ error: 'Invalid year parameter' }, { status: 400 });
	}

	try {
		const context = await getTaxYearContext(db, userId, year);
		const taxpayerType = context.eligibility.taxpayerType;
		if (context.eligibility.status !== 'eligible' || !taxpayerType) {
			return json(
				{
					error: context.eligibility.reasons[0] || 'Estimasi pajak tidak tersedia.',
					eligibility: context.eligibility
				},
				{ status: 422 }
			);
		}
		const monthlyRevenues = context.aggregatedMonthlyRevenue;

		// Payment records and the expense total are independent. Aggregate expenses
		// in D1 instead of transferring every expense row to the Worker.
		const [taxRecords, totalExpenses] = await Promise.all([
			getTaxRecordsForYear(db, userId, year),
			getRecordedAnnualExpenseTotal(db, userId, year)
		]);

		// Build monthly breakdown
		const months: {
			month: number;
			monthName: string;
			grossRevenue: number;
			taxableRevenue: number;
			taxRate: string;
			taxAmount: number;
			paidAmount: number;
			taxStatus: string;
			isBelowThreshold: boolean;
		}[] = [];

		let cumulativeRevenue = 0;

		for (let month = 1; month <= 12; month++) {
			const revenue = monthlyRevenues[month - 1] || 0;
			const previousCumulative = cumulativeRevenue;
			cumulativeRevenue = previousCumulative + revenue;

			const taxCalculation = calculateMonthlyTax({
				userId,
				taxpayerType,
				year,
				month,
				grossRevenue: revenue,
				previousCumulativeRevenue: previousCumulative
			});

			// Get tax record for this month
			const taxRec = taxRecords.find((tr) => tr.month === month);
			const paymentStatus = taxRec?.status || TAX_STATUS.UNPAID;

			months.push({
				month,
				monthName: INDONESIAN_MONTHS[month - 1],
				grossRevenue: revenue,
				taxableRevenue: taxCalculation.taxableRevenue,
				taxRate: `${(taxCalculation.taxRate / 100).toLocaleString('id-ID')}%`,
				taxAmount: taxCalculation.taxAmount,
				paidAmount: taxRec?.status === TAX_STATUS.PAID ? taxRec.taxAmount : 0,
				taxStatus: paymentStatus,
				isBelowThreshold: taxCalculation.isBelowThreshold
			});
		}

		// Calculate annual totals
		const totalGrossRevenue = months.reduce((sum, m) => sum + m.grossRevenue, 0);
		const totalTaxableRevenue = months.reduce((sum, m) => sum + m.taxableRevenue, 0);
		const totalTaxPaid = months.reduce((sum, m) => sum + m.paidAmount, 0);
		const totalTaxDue = months.reduce((sum, m) => sum + m.taxAmount, 0);
		const totalRecordedGrossRevenue = context.recordedMonthlyRevenue.reduce(
			(sum, amount) => sum + amount,
			0
		);
		const totalExternalGrossRevenue = context.externalMonthlyRevenue.reduce(
			(sum, amount) => sum + amount,
			0
		);

		const netIncome = totalRecordedGrossRevenue - totalExpenses;

		// Build response
		const response = {
			year,
			taxpayerType,
			calculationStatus: 'estimate',
			eligibility: context.eligibility,
			months,
			summary: {
				totalGrossRevenue,
				totalRecordedGrossRevenue,
				totalExternalGrossRevenue,
				totalTaxableRevenue,
				totalTaxDue,
				totalTaxPaid,
				totalExpenses,
				netIncome,
				thresholdAmount: taxpayerType === TAXPAYER_TYPE.WP_BADAN ? null : REVENUE_THRESHOLD_WP_OP,
				thresholdExceeded: months.some((m) => !m.isBelowThreshold)
			},
			generatedAt: new Date().toISOString()
		};

		return json({ data: response });
	} catch {
		console.error('Error in GET /api/tax/annual:');
		return json({ error: 'Failed to fetch annual tax data' }, { status: 500 });
	}
};
