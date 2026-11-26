import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { calculateAnnualTax } from '$lib/tax/engine';
import { getTaxRecordsForYear, getTaxYearContext } from '$lib/tax/service';
import { jakartaToday } from '$lib/tax/period';
import { findOutstandingMonths, reminderPeriod, reminderUrgency } from '$lib/tax/reminder';

/**
 * GET /api/tax/reminder
 *
 * Lists every earlier month of the current year (in January: December of the previous
 * year) whose recomputed PPh Final estimate is unpaid, or higher than the amount recorded
 * as paid.
 *
 * Response:
 * - showReminder: boolean
 * - items: { year, month, status: 'unpaid' | 'underpaid', taxAmount, paidAmount,
 *   outstandingAmount, dueDate, daysUntilDue, billingCodeUrl }[], oldest first
 * - totalOutstanding: number
 * - urgencyLevel: 'low' | 'medium' | 'high'
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const today = jakartaToday();
		const { year, months } = reminderPeriod(today);
		const lastMonth = months[months.length - 1];

		const [context, records] = await Promise.all([
			getTaxYearContext(db, userId, year, lastMonth),
			getTaxRecordsForYear(db, userId, year)
		]);
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

		const annualTax = calculateAnnualTax(
			context.aggregatedMonthlyRevenue.map((revenue, index) => ({ month: index + 1, revenue })),
			taxpayerType,
			year
		);
		const items = findOutstandingMonths({
			year,
			months,
			monthlyTax: annualTax.months.map((month) => month.taxAmount),
			records,
			today: today.date
		});

		if (items.length === 0) {
			return json({ data: { showReminder: false, reason: 'nothing_outstanding' } });
		}

		return json({
			data: {
				showReminder: true,
				items,
				totalOutstanding: items.reduce((sum, item) => sum + item.outstandingAmount, 0),
				urgencyLevel: reminderUrgency(items),
				taxpayerType,
				calculationStatus: 'estimate'
			}
		});
	} catch {
		console.error('Error in GET /api/tax/reminder:');
		return json({ error: 'Failed to fetch tax reminder' }, { status: 500 });
	}
};
