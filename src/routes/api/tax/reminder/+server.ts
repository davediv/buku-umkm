import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transaction } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calculateMonthlyTax } from '$lib/tax/engine';
import {
	calculateMonthlyRevenues,
	calculateCumulativeRevenue,
	getTaxRecordForMonth,
	getTaxpayerType
} from '$lib/tax/service';
import { TAX_STATUS, REVENUE_THRESHOLD_WP_OP } from '$lib/tax/config';

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

		// Get taxpayer type
		const taxpayerType = await getTaxpayerType(db, userId);

		// If no taxpayer type configured, don't show reminder
		if (!taxpayerType) {
			return json({
				data: {
					showReminder: false,
					reason: 'no_taxpayer_type'
				}
			});
		}

		// Get all income transactions for the previous month year up to previous month
		const yearStartDate = `${previousMonthYear}-01-01`;
		const monthEndDate = `${previousMonthYear}-${previousMonth.toString().padStart(2, '0')}-31`;

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
					lte(transaction.date, monthEndDate)
				)
			);

		// Calculate monthly revenues
		const monthlyRevenues = calculateMonthlyRevenues(transactions);

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

		// For WP OP: only show if cumulative revenue > 500M
		if (taxpayerType === 'perorangan' && cumulativeRevenue <= REVENUE_THRESHOLD_WP_OP) {
			return json({
				data: {
					showReminder: false,
					reason: 'wp_op_below_threshold',
					cumulativeRevenue,
					threshold: REVENUE_THRESHOLD_WP_OP
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
			cumulativeRevenue
		};

		return json({ data: response });
	} catch (error) {
		console.error('Error in GET /api/tax/reminder:', error);
		return json({ error: 'Failed to fetch tax reminder' }, { status: 500 });
	}
};
