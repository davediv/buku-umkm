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
	getUserTaxData,
	getIndonesianMonthName,
	formatMasaPajak
} from '$lib/tax/service';
import { TAX_STATUS } from '$lib/tax/config';

/**
 * GET /api/tax/billing-code/[year]/[month]
 *
 * Returns billing code prep data:
 * - KAP (Kode Akun Pajak): 411128 (PPh Final Pasal 4(2))
 * - KJS (Kode Jenis Setoran): 420 (PPh Final)
 * - NPWP: User's NPWP
 * - Amount: Tax amount due
 * - Period: Tax period (Masa Pajak)
 */

/** KAP - Kode Akun Pajak for PPh Final Pasal 4(2) */
const KAP = '411128';

/** KJS - Kode Jenis Setoran for PPh Final */
const KJS = '420';

export const GET: RequestHandler = async ({ locals, params }) => {
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

		// Get user data (NPWP, taxpayer type, business name)
		const userTaxData = await getUserTaxData(db, userId);

		// Get transactions up to the specified month
		const yearStartDate = `${year}-01-01`;
		const monthEndDate = `${year}-${month.toString().padStart(2, '0')}-31`;

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
		const monthlyAmounts = calculateMonthlyRevenues(transactions);

		// Calculate cumulative revenue up to this month
		const previousCumulativeRevenue = calculateCumulativeRevenue(monthlyAmounts, month - 1);

		// Calculate tax for this month
		const taxCalculation = calculateMonthlyTax({
			userId,
			taxpayerType: userTaxData.taxpayerType,
			year,
			month,
			grossRevenue: monthlyAmounts[month - 1],
			previousCumulativeRevenue
		});

		// Get existing tax record if any
		const taxRec = await getTaxRecordForMonth(db, userId, year, month);

		// Build response
		const response = {
			// Billing code components
			kap: KAP, // Kode Akun Pajak
			kjs: KJS, // Kode Jenis Setoran
			npwp: userTaxData.npwp || null,
			namaWp: userTaxData.businessName || locals.user.name || null,
			// Tax period
			masaPajak: formatMasaPajak(month, year),
			bulan: getIndonesianMonthName(month),
			tahun: year,
			// Amount
			jumlahSetor: taxCalculation.taxAmount,
			taxableRevenue: taxCalculation.taxableRevenue,
			grossRevenue: taxCalculation.grossRevenue,
			// Status
			status: taxRec?.status || TAX_STATUS.UNPAID,
			isBelowThreshold: taxCalculation.isBelowThreshold,
			taxpayerType: userTaxData.taxpayerType,
			// Additional info
			thresholdAmount: taxCalculation.thresholdAmount,
			cumulativeRevenue: taxCalculation.cumulativeRevenue,
			thresholdPercentage: taxCalculation.thresholdPercentage
		};

		return json({ data: response });
	} catch (error) {
		console.error('Error in GET /api/tax/billing-code/[year]/[month]:', error);
		return json({ error: 'Failed to fetch billing code data' }, { status: 500 });
	}
};
