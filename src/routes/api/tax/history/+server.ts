import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { calculateAnnualTax, getThresholdInfo } from '$lib/tax/engine';
import { getTaxRecordsForYear, getTaxYearContext } from '$lib/tax/service';
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

		const [context, existingRecords] = await Promise.all([
			getTaxYearContext(db, userId, year),
			getTaxRecordsForYear(db, userId, year)
		]);
		const taxpayerType = context.eligibility.taxpayerType;
		const calculationAvailable = context.eligibility.status === 'eligible' && taxpayerType !== null;
		const monthlyRevenues = context.aggregatedMonthlyRevenue.map((revenue, index) => ({
			month: index + 1,
			revenue
		}));

		// Calculate annual tax using the engine
		const annualTax = calculationAvailable
			? calculateAnnualTax(monthlyRevenues, taxpayerType, year)
			: null;

		// Get existing tax records for this year
		// Create a map of existing records by month
		const recordsByMonth = new Map<number, (typeof existingRecords)[0]>();
		for (const rec of existingRecords) {
			if (rec.month) {
				recordsByMonth.set(rec.month, rec);
			}
		}

		// Build monthly breakdown
		const monthlyRecords = monthlyRevenues.map(({ month, revenue }, index) => {
			const calc = annualTax?.months[index] ?? null;
			const existingRecord = recordsByMonth.get(month);

			return {
				year,
				month,
				grossRevenue: revenue,
				recordedRevenue: context.recordedMonthlyRevenue[index] ?? 0,
				externalRevenue: context.externalMonthlyRevenue[index] ?? 0,
				taxableRevenue: calc?.taxableRevenue ?? null,
				taxAmount: calc?.taxAmount ?? null,
				taxRate: calc?.taxRate ?? null,
				status: calculationAvailable ? existingRecord?.status || TAX_STATUS.UNPAID : null,
				paymentDate: existingRecord?.paymentDate || null,
				billingCode: existingRecord?.billingCode || null,
				isBelowThreshold: calc?.isBelowThreshold ?? null,
				cumulativeRevenue:
					calc?.cumulativeRevenue ??
					context.aggregatedMonthlyRevenue
						.slice(0, index + 1)
						.reduce((sum, amount) => sum + amount, 0),
				thresholdPercentage: calc?.thresholdPercentage ?? null
			};
		});

		// Calculate totals
		const totalGrossRevenue = monthlyRecords.reduce((sum, r) => sum + r.grossRevenue, 0);
		const totalTaxableRevenue = calculationAvailable
			? monthlyRecords.reduce((sum, r) => sum + (r.taxableRevenue ?? 0), 0)
			: null;
		const totalTaxAmount = calculationAvailable
			? monthlyRecords.reduce((sum, r) => sum + (r.taxAmount ?? 0), 0)
			: null;
		const paidMonths = monthlyRecords.filter((r) => r.status === TAX_STATUS.PAID).length;
		const unpaidMonths = monthlyRecords.filter(
			(r) => r.status === TAX_STATUS.UNPAID && (r.taxAmount ?? 0) > 0
		).length;

		// Get threshold info
		const finalCumulativeRevenue =
			monthlyRecords[monthlyRecords.length - 1]?.cumulativeRevenue || 0;
		const thresholdInfo = getThresholdInfo(finalCumulativeRevenue);

		const response = {
			year,
			taxpayerType,
			calculationStatus: calculationAvailable ? 'estimate' : 'unavailable',
			profileConfigured: context.profile !== null,
			eligibility: context.eligibility,
			totalGrossRevenue,
			totalTaxableRevenue,
			totalTaxAmount,
			thresholdInfo: {
				threshold: thresholdInfo.threshold,
				currentRevenue: finalCumulativeRevenue,
				percentage: thresholdInfo.percentage,
				isExceeded: thresholdInfo.isExceeded,
				thresholdExceededMonth: annualTax?.thresholdExceededMonth ?? null
			},
			summary: {
				totalMonths: 12,
				monthsWithTax: monthlyRecords.filter((r) => (r.taxAmount ?? 0) > 0).length,
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
