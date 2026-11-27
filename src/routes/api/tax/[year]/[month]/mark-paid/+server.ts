import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { taxRecord } from '#lib/server/db/schema.ts';
import { calculateMonthlyTax } from '#lib/tax/engine.ts';
import { calculateCumulativeRevenue, getTaxYearContext } from '#lib/tax/service.ts';
import { TAX_TYPE, TAX_STATUS } from '#lib/tax/config.ts';
import { jakartaToday } from '#lib/tax/period.ts';
import { isWholeRupiah, normalizePaymentReference } from '#lib/tax/payments.ts';
import { isIsoCalendarDate } from '#lib/shared/dates.ts';

/**
 * POST /api/tax/[year]/[month]/mark-paid
 *
 * Body:
 * - paidAmount: whole Rupiah actually paid (JSON number, required)
 * - paymentDate: ISO date, not after today in Jakarta (default: today)
 * - billingCode: kode billing (15 digits) or NTPN (16 letters/digits), optional
 *
 * Records the month as paid with the amount actually paid. Marking again replaces the
 * recorded payment, so enter the total paid for the month.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Parse year and month from params
		const year = parseInt(params.year, 10);
		const month = parseInt(params.month, 10);

		// Validate year and month
		if (isNaN(year) || year < 2000 || year > 2100) {
			return Response.json({ error: 'Invalid year parameter' }, { status: 400 });
		}
		if (isNaN(month) || month < 1 || month > 12) {
			return Response.json({ error: 'Invalid month parameter' }, { status: 400 });
		}

		let body: Record<string, unknown>;
		try {
			const parsed: unknown = await request.json();
			if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
			body = parsed as Record<string, unknown>;
		} catch {
			return Response.json({ error: 'JSON tidak valid.' }, { status: 400 });
		}

		if (!isWholeRupiah(body.paidAmount)) {
			return Response.json(
				{ error: 'Jumlah yang dibayar harus berupa angka Rupiah utuh, tidak negatif.' },
				{ status: 400 }
			);
		}
		const paidAmount = body.paidAmount;

		// Default payment date to today on the Jakarta calendar
		const today = jakartaToday().date;
		const paymentDate = body.paymentDate ?? today;
		if (typeof paymentDate !== 'string' || !isIsoCalendarDate(paymentDate)) {
			return Response.json({ error: 'Tanggal bayar tidak valid.' }, { status: 400 });
		}
		if (paymentDate > today) {
			return Response.json(
				{ error: 'Tanggal bayar tidak boleh setelah hari ini.' },
				{ status: 400 }
			);
		}

		const reference = normalizePaymentReference(body.billingCode);
		if (!reference.ok) return Response.json({ error: reference.error }, { status: 400 });
		const billingCode = reference.value;

		const context = await getTaxYearContext(db, userId, year, month);
		const taxpayerType = context.eligibility.taxpayerType;
		if (context.eligibility.status !== 'eligible' || !taxpayerType) {
			return Response.json(
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
			return Response.json(
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
				paidAmount,
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
					paidAmount,
					updatedAt: new Date()
				}
			})
			.returning({ id: taxRecord.id });

		return Response.json({
			message: 'Tax marked as paid',
			data: {
				id: saved.id,
				year,
				month,
				taxAmount: taxCalculation.taxAmount,
				paidAmount,
				underpaidAmount: Math.max(0, taxCalculation.taxAmount - paidAmount),
				status: TAX_STATUS.PAID,
				paymentDate,
				billingCode
			}
		});
	} catch {
		console.error('Error in POST /api/tax/[year]/[month]/mark-paid:');
		return Response.json({ error: 'Failed to mark tax as paid' }, { status: 500 });
	}
};
