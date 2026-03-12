/**
 * Tax Engine
 *
 * PPh Final 0.5% calculation engine for Indonesian UMKM taxpayers
 * Handles WP OP (perorangan) threshold tracking and WP Badan calculations
 *
 * Business Rules:
 * - WP OP: Taxable when cumulative annual revenue > Rp500M
 *   - Below threshold: tax = 0
 *   - Above threshold: tax = 0.5% x monthly revenue
 *   - Mid-month threshold crossing: only revenue above threshold is taxed
 * - WP Badan: tax = 0.5% x monthly revenue from month 1 (no threshold)
 * - Tax year resets on January 1
 * - Revenue = gross total income (not net profit)
 */

import * as TaxConfig from './config';
import type {
	MonthlyTaxCalculation,
	AnnualTaxSummary,
	TaxCalculationInput,
	TaxpayerType,
	ThresholdInfo
} from './types';

/**
 * Calculate PPh Final tax for a single month
 *
 * @param input - Tax calculation input
 * @returns Monthly tax calculation result
 */
export function calculateMonthlyTax(input: TaxCalculationInput): MonthlyTaxCalculation {
	const { year, month, grossRevenue, previousCumulativeRevenue, taxpayerType } = input;

	// Cumulative revenue BEFORE this month's revenue
	const cumulativeBeforeThisMonth = previousCumulativeRevenue;
	// Cumulative revenue AFTER this month's revenue (floor at 0)
	const cumulativeAfterThisMonth = Math.max(0, cumulativeBeforeThisMonth + grossRevenue);

	let taxableRevenue = 0;
	let taxAmount = 0;
	let isBelowThreshold = true;

	if (taxpayerType === TaxConfig.TAXPAYER_TYPE.WP_BADAN) {
		// WP Badan: Always taxable from month 1, no threshold
		taxableRevenue = Math.max(0, grossRevenue);
		taxAmount = Math.floor(taxableRevenue * TaxConfig.TAX_RATE_DECIMAL);
		isBelowThreshold = false;
	} else {
		// WP OP: Check threshold
		const threshold = TaxConfig.REVENUE_THRESHOLD_WP_OP;

		if (cumulativeBeforeThisMonth >= threshold) {
			// Already exceeded threshold in previous months
			// Full monthly revenue is taxable
			taxableRevenue = grossRevenue;
			taxAmount = Math.floor(grossRevenue * TaxConfig.TAX_RATE_DECIMAL);
			isBelowThreshold = false;
		} else if (cumulativeAfterThisMonth > threshold) {
			// Threshold exceeded this month
			// Only revenue ABOVE threshold is taxable
			const excessRevenue = cumulativeAfterThisMonth - threshold;
			taxableRevenue = excessRevenue;
			taxAmount = Math.floor(excessRevenue * TaxConfig.TAX_RATE_DECIMAL);
			isBelowThreshold = false;
		} else {
			// Still below threshold - no tax due
			taxableRevenue = 0;
			taxAmount = 0;
			isBelowThreshold = true;
		}
	}

	const thresholdPercentage = Math.min(
		100,
		(cumulativeAfterThisMonth / TaxConfig.REVENUE_THRESHOLD_WP_OP) * 100
	);

	return {
		year,
		month,
		grossRevenue,
		taxableRevenue,
		taxRate: TaxConfig.TAX_RATE_BPS,
		taxAmount,
		isBelowThreshold,
		thresholdAmount: TaxConfig.REVENUE_THRESHOLD_WP_OP,
		cumulativeRevenue: cumulativeAfterThisMonth,
		thresholdPercentage
	};
}

/**
 * Calculate annual tax summary
 *
 * @param monthlyRevenues - Array of { month, revenue } for the year
 * @param taxpayerType - WP OP or WP Badan
 * @param year - Tax year
 * @returns Annual tax summary with monthly breakdown
 */
export function calculateAnnualTax(
	monthlyRevenues: { month: number; revenue: number }[],
	taxpayerType: TaxpayerType,
	year: number
): AnnualTaxSummary {
	const months: MonthlyTaxCalculation[] = [];
	let cumulativeRevenue = 0;
	let totalGrossRevenue = 0;
	let totalTaxableRevenue = 0;
	let totalTaxAmount = 0;
	let thresholdExceeded = false;
	let thresholdExceededMonth: number | undefined;

	// Sort by month
	const sortedRevenues = [...monthlyRevenues].sort((a, b) => a.month - b.month);

	for (const { month, revenue } of sortedRevenues) {
		const calculation = calculateMonthlyTax({
			userId: '',
			taxpayerType,
			year,
			month,
			grossRevenue: revenue,
			previousCumulativeRevenue: cumulativeRevenue
		});

		months.push(calculation);
		cumulativeRevenue = calculation.cumulativeRevenue;
		totalGrossRevenue += calculation.grossRevenue;
		totalTaxableRevenue += calculation.taxableRevenue;
		totalTaxAmount += calculation.taxAmount;

		// Only track threshold for WP OP (perorangan), not WP Badan
		if (
			taxpayerType === TaxConfig.TAXPAYER_TYPE.WP_OP &&
			!thresholdExceeded &&
			!calculation.isBelowThreshold
		) {
			thresholdExceeded = true;
			thresholdExceededMonth = month;
		}
	}

	return {
		year,
		taxpayerType,
		totalGrossRevenue,
		totalTaxableRevenue,
		totalTaxAmount,
		months,
		thresholdExceeded,
		thresholdExceededMonth
	};
}

/**
 * Get threshold information for a user
 *
 * @param cumulativeRevenue - Current cumulative annual revenue
 * @returns Threshold info with percentage and status
 */
export function getThresholdInfo(cumulativeRevenue: number): ThresholdInfo {
	const threshold = TaxConfig.REVENUE_THRESHOLD_WP_OP;
	const percentage = Math.min(100, (cumulativeRevenue / threshold) * 100);
	const isExceeded = cumulativeRevenue > threshold;

	return {
		threshold,
		currentRevenue: cumulativeRevenue,
		percentage,
		isExceeded
	};
}

/**
 * Calculate tax amount (simple helper)
 *
 * @param grossRevenue - Gross revenue in Rupiah
 * @returns Tax amount in Rupiah
 */
export function calculateTax(grossRevenue: number): number {
	if (grossRevenue <= 0) return 0;
	return Math.floor(grossRevenue * TaxConfig.TAX_RATE_DECIMAL);
}

/**
 * Check if threshold alert should be shown
 *
 * @param cumulativeRevenue - Current cumulative annual revenue
 * @returns Alert level: null, 'warning' (80%), or 'critical' (100%)
 */
export function getThresholdAlertLevel(cumulativeRevenue: number): 'warning' | 'critical' | null {
	const threshold = TaxConfig.REVENUE_THRESHOLD_WP_OP;
	const percentage = (cumulativeRevenue / threshold) * 100;

	if (percentage >= 100) {
		return 'critical';
	}
	if (percentage >= 80) {
		return 'warning';
	}
	return null;
}

/**
 * Get threshold color based on percentage
 *
 * @param percentage - Threshold percentage (0-100)
 * @returns Color: green, yellow, or red
 */
export function getThresholdColor(percentage: number): 'green' | 'yellow' | 'red' {
	if (percentage < 70) {
		return 'green';
	}
	if (percentage < 90) {
		return 'yellow';
	}
	return 'red';
}

/**
 * Format currency for display
 *
 * @param amount - Amount in Rupiah
 * @returns Formatted string (e.g., "Rp 1.000.000")
 */
export function formatRupiah(amount: number): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(amount);
}
