/**
 * Tax Configuration
 *
 * PPh Final 0.5% configuration for Indonesian UMKM taxpayers
 * Based on PMK 99/2018 and PP 23/2018
 */

/** Tax rate in basis points (50 = 0.5%) */
export const TAX_RATE_BPS = 50;

/** PPh Final tax rate as decimal (0.005 = 0.5%) */
export const TAX_RATE_DECIMAL = 0.005;

/** Annual revenue threshold for WP OP in Rupiah (Rp 500,000,000) */
export const REVENUE_THRESHOLD_WP_OP = 500_000_000;

/** Tax year start month (January = 1) */
export const TAX_YEAR_START_MONTH = 1;

/** Tax types */
export const TAX_TYPE = {
	PPH_FINAL: 'pph_final',
	PPN: 'ppn'
} as const;

/** Tax status */
export const TAX_STATUS = {
	UNPAID: 'unpaid',
	PAID: 'paid',
	OVERDUE: 'overdue'
} as const;

/** Taxpayer types */
export const TAXPAYER_TYPE = {
	WP_OP: 'perorangan', // WP OP - Wajib Pajak Orang Pribadi
	WP_BADAN: 'badan' // WP Badan - Wajib Pajak Badan
} as const;

/**
 * Get tax rate in basis points
 */
export function getTaxRateBps(): number {
	return TAX_RATE_BPS;
}

/**
 * Get tax rate as decimal
 */
export function getTaxRateDecimal(): number {
	return TAX_RATE_DECIMAL;
}

/**
 * Get revenue threshold for WP OP
 */
export function getRevenueThresholdWpOp(): number {
	return REVENUE_THRESHOLD_WP_OP;
}

/**
 * Calculate tax amount from gross revenue
 * @param grossRevenue - Gross revenue in Rupiah
 * @returns Tax amount in Rupiah (rounded down)
 */
export function calculateTaxFromRevenue(grossRevenue: number): number {
	if (grossRevenue <= 0) return 0;
	return Math.floor(grossRevenue * TAX_RATE_DECIMAL);
}

// ============================================================================
// Indonesian Localization
// ============================================================================

/** Indonesian month names */
export const INDONESIAN_MONTHS = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember'
] as const;

/**
 * Get Indonesian month name by number (1-12)
 */
export function getIndonesianMonthName(month: number): string {
	if (month < 1 || month > 12) return '';
	return INDONESIAN_MONTHS[month - 1];
}
