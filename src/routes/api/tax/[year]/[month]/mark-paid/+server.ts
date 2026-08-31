import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { taxRecord } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { calculateMonthlyTax } from '$lib/tax/engine';
import {
	calculateCumulativeRevenue,
	getTaxRecordForMonth,
	getTaxYearContext
} from '$lib/tax/service';
import { TAX_TYPE, TAX_STATUS } from '$lib/tax/config';

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

		// Default payment date to today
		const paymentDate = body.paymentDate || new Date().toISOString().split('T')[0];
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

		// Check if there's an existing tax record for this month
		const existingRecord = await getTaxRecordForMonth(db, userId, year, month);

		if (existingRecord) {
			// Update existing record
			await db
				.update(taxRecord)
				.set({
					status: TAX_STATUS.PAID,
					paymentDate,
					billingCode: billingCode || null,
					taxableIncome: taxCalculation.taxableRevenue,
					taxAmount: taxCalculation.taxAmount,
					updatedAt: new Date()
				})
				.where(eq(taxRecord.id, existingRecord.id));

			return json({
				message: 'Tax payment updated',
				data: {
					id: existingRecord.id,
					year,
					month,
					taxAmount: taxCalculation.taxAmount,
					status: TAX_STATUS.PAID,
					paymentDate,
					billingCode
				}
			});
		} else {
			// Create new tax record
			const newId = crypto.randomUUID();
			await db.insert(taxRecord).values({
				id: newId,
				userId,
				year,
				month,
				taxType: TAX_TYPE.PPH_FINAL,
				taxableIncome: taxCalculation.taxableRevenue,
				taxRate: taxCalculation.taxRate,
				taxAmount: taxCalculation.taxAmount,
				status: TAX_STATUS.PAID,
				paymentDate,
				billingCode: billingCode || null
			});

			return json(
				{
					message: 'Tax marked as paid',
					data: {
						id: newId,
						year,
						month,
						taxAmount: taxCalculation.taxAmount,
						status: TAX_STATUS.PAID,
						paymentDate,
						billingCode
					}
				},
				{ status: 201 }
			);
		}
	} catch {
		console.error('Error in POST /api/tax/[year]/[month]/mark-paid:');
		return json({ error: 'Failed to mark tax as paid' }, { status: 500 });
	}
};
