import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { calculateMonthlyTax } from '$lib/tax/engine';
import {
	calculateMonthlyRevenues,
	calculateCumulativeRevenue,
	getTaxRecordForMonth,
	getTaxYearContext,
	getYearTransactions
} from '$lib/tax/service';
import { TAX_STATUS } from '$lib/tax/config';

/**
 * GET /api/tax/reminder
 *
 * Returns tax reminder data for the previous month if:
 * - Current date is >= 1st of the month
 * - Previous month tax is unpaid
 * - For WP OP: cumulative annual revenue > Rp 500M
 * - For WP Badan: always show if unpaid
 *
 * Response:
 * - showReminder: boolean
 * - previousMonth: number (1-12)
 * - previousMonthYear: number
 * - taxAmount: number
 * - dueDateDay: number (15)
 * - daysUntilDue: number
 * - urgencyLevel: 'low' | 'medium' | 'high'
 * - billingCodeUrl: string
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Get current date info
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1; // 1-12
		const currentDay = now.getDate();

		// Calculate previous month
		let previousMonth = currentMonth - 1;
		let previousMonthYear = currentYear;

		if (previousMonth < 1) {
			previousMonth = 12;
			previousMonthYear = currentYear - 1;
		}

		// Only show reminder starting from day 1 of the month
		if (currentDay < 1) {
			return json({
				data: {
					showReminder: false,
					reason: 'before_reminder_period'
				}
			});
		}

		const recordedMonthlyRevenue = calculateMonthlyRevenues(
			await getYearTransactions(db, userId, previousMonthYear, previousMonth)
		);
		const context = await getTaxYearContext(db, userId, previousMonthYear, recordedMonthlyRevenue);
		const taxpayerType = context.eligibility.taxpayerType;
		if (context.eligibility.status !== 'eligible' || !taxpayerType) {
			return json({
				data: {
					showReminder: false,
					reason: 'tax_estimate_unavailable',
					eligibility: context.eligibility
				}
			});
		}
		const monthlyRevenues = context.aggregatedMonthlyRevenue;

		// Calculate cumulative revenue up to previous month
		const cumulativeRevenue = calculateCumulativeRevenue(monthlyRevenues, previousMonth);
		const previousCumulativeRevenue = calculateCumulativeRevenue(
			monthlyRevenues,
			previousMonth - 1
		);

		// Get previous month revenue
		const previousMonthRevenue = monthlyRevenues[previousMonth - 1] || 0;

		// Calculate previous month tax using the engine
		const taxCalculation = calculateMonthlyTax({
			userId,
			taxpayerType,
			year: previousMonthYear,
			month: previousMonth,
			grossRevenue: previousMonthRevenue,
			previousCumulativeRevenue
		});

		// If tax amount is 0 (below threshold), don't show reminder
		if (taxCalculation.taxAmount === 0) {
			return json({
				data: {
					showReminder: false,
					reason: 'below_threshold',
					taxAmount: 0
				}
			});
		}

		// Check if tax is already paid for previous month
		const taxRec = await getTaxRecordForMonth(db, userId, previousMonthYear, previousMonth);

		if (taxRec?.status === TAX_STATUS.PAID) {
			return json({
				data: {
					showReminder: false,
					reason: 'already_paid',
					paymentDate: taxRec.paymentDate
				}
			});
		}

		// Calculate urgency level based on days until 15th
		const dueDay = 15;
		const daysUntilDue = dueDay - currentDay;

		// Urgency levels:
		// - high: day 11-15 (approaching due date)
		// - medium: day 6-10
		// - low: day 1-5
		let urgencyLevel: 'low' | 'medium' | 'high' = 'low';
		if (daysUntilDue <= 0) {
			urgencyLevel = 'high'; // Overdue
		} else if (daysUntilDue <= 5) {
			urgencyLevel = 'high';
		} else if (daysUntilDue <= 10) {
			urgencyLevel = 'medium';
		}

		// Build the reminder response
		const response = {
			showReminder: true,
			previousMonth,
			previousMonthYear,
			taxAmount: taxCalculation.taxAmount,
			dueDateDay: dueDay,
			daysUntilDue: Math.max(0, daysUntilDue),
			urgencyLevel,
			billingCodeUrl: `/pajak/kode-billing/${previousMonthYear}/${previousMonth}`,
			taxpayerType,
			cumulativeRevenue,
			calculationStatus: 'estimate'
		};

		return json({ data: response });
	} catch {
		console.error('Error in GET /api/tax/reminder:');
		return json({ error: 'Failed to fetch tax reminder' }, { status: 500 });
	}
};
