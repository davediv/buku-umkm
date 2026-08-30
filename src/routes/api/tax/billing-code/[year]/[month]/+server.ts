import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { calculateMonthlyTax } from '$lib/tax/engine';
import {
	calculateMonthlyRevenues,
	calculateCumulativeRevenue,
	getTaxRecordForMonth,
	getUserTaxData,
	getIndonesianMonthName,
	formatMasaPajak,
	getTaxYearContext,
	getYearTransactions
} from '$lib/tax/service';
import { TAX_STATUS } from '$lib/tax/config';

/**
 * GET /api/tax/billing-code/[year]/[month]
 *
 * Returns fields that help the user create an official billing code in Coretax:
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
		const userTaxData = await getUserTaxData(db, userId, year);
		const recordedMonthlyRevenue = calculateMonthlyRevenues(
			await getYearTransactions(db, userId, year, month)
		);
		const context = await getTaxYearContext(db, userId, year, recordedMonthlyRevenue);
		if (context.eligibility.status !== 'eligible' || !userTaxData.taxpayerType) {
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
			thresholdPercentage: taxCalculation.thresholdPercentage,
			calculationStatus: 'estimate',
			eligibility: context.eligibility,
			officialBillingUrl: 'https://coretaxdjp.pajak.go.id/'
		};

		return json({ data: response });
	} catch {
		console.error('Error in GET /api/tax/billing-code/[year]/[month]:');
		return json({ error: 'Failed to fetch billing code data' }, { status: 500 });
	}
};
