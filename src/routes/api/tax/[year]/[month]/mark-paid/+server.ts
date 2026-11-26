import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { taxRecord } from '$lib/server/db/schema';
import { calculateMonthlyTax } from '$lib/tax/engine';
import { calculateCumulativeRevenue, getTaxYearContext } from '$lib/tax/service';
import { TAX_TYPE, TAX_STATUS } from '$lib/tax/config';
import { jakartaToday } from '$lib/tax/period';

/**
 * POST /api/tax/[year]/[month]/mark-paid
 *
 * Body (optional):
 * - paymentDate: ISO date string (default: today)
 * - billingCode: NTPN code (optional)
 *
 * Marks tax as paid for the specified month
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Parse year and month from params
		const year = parseInt(params.year, 10);
		const month = parseInt(params.month, 10);

		// Validate year and month
		if (isNaN(year) || year < 2000 || year > 2100) {
			return json({ error: 'Invalid year parameter' }, { status: 400 });
		}
		if (isNaN(month) || month < 1 || month > 12) {
			return json({ error: 'Invalid month parameter' }, { status: 400 });
		}

		// Parse request body
		let body: { paymentDate?: string; billingCode?: string } = {};
		try {
			body = await request.json();
		} catch {
			// Ignore JSON parse errors, use defaults
		}

		// Default payment date to today on the Jakarta calendar
		const paymentDate = body.paymentDate || jakartaToday().date;
		const billingCode = body.billingCode || null;

		const context = await getTaxYearContext(db, userId, year, month);
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
		const monthlyAmounts = context.aggregatedMonthlyRevenue;

		// Calculate cumulative revenue up to this month
		const previousCumulativeRevenue = calculateCumulativeRevenue(monthlyAmounts, month - 1);

		// Calculate tax for this month
		const taxCalculation = calculateMonthlyTax({
			userId,
			taxpayerType,
			year,
			month,
			grossRevenue: monthlyAmounts[month - 1],
			previousCumulativeRevenue
		});
		if (taxCalculation.taxAmount <= 0) {
			return json(
				{ error: 'Tidak ada estimasi pajak untuk ditandai sebagai dibayar.' },
				{ status: 409 }
			);
		}

		// One statement keyed on the (user, year, month, tax type) unique index, so a
		// double submit updates the same record instead of inserting a second one.
		const [saved] = await db
			.insert(taxRecord)
			.values({
				id: crypto.randomUUID(),
				userId,
				year,
				month,
				taxType: TAX_TYPE.PPH_FINAL,
				taxableIncome: taxCalculation.taxableRevenue,
				taxRate: taxCalculation.taxRate,
				taxAmount: taxCalculation.taxAmount,
				status: TAX_STATUS.PAID,
				paymentDate,
				billingCode
			})
			.onConflictDoUpdate({
				target: [taxRecord.userId, taxRecord.year, taxRecord.month, taxRecord.taxType],
				set: {
					status: TAX_STATUS.PAID,
					paymentDate,
					billingCode,
					taxableIncome: taxCalculation.taxableRevenue,
					taxRate: taxCalculation.taxRate,
					taxAmount: taxCalculation.taxAmount,
					updatedAt: new Date()
				}
			})
			.returning({ id: taxRecord.id });

		return json({
			message: 'Tax marked as paid',
			data: {
				id: saved.id,
				year,
				month,
				taxAmount: taxCalculation.taxAmount,
				status: TAX_STATUS.PAID,
				paymentDate,
				billingCode
			}
		});
	} catch {
		console.error('Error in POST /api/tax/[year]/[month]/mark-paid:');
		return json({ error: 'Failed to mark tax as paid' }, { status: 500 });
	}
};
