/**
 * Tax Engine Unit Tests
 *
 * Tests for PPh Final 0.5% tax calculation engine
 */

import { describe, it, expect } from 'vitest';
import {
	calculateMonthlyTax,
	calculateAnnualTax,
	getThresholdInfo,
	calculateTax,
	getThresholdAlertLevel,
	getThresholdColor,
	formatRupiah
} from '$lib/tax/engine';
import { TAXPAYER_TYPE } from '$lib/tax/config';

describe('Tax Engine', () => {
	describe('calculateMonthlyTax', () => {
		describe('WP OP (perorangan)', () => {
			it('should return 0 tax when below threshold', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 1,
					grossRevenue: 10_000_000, // 10M
					previousCumulativeRevenue: 0
				});

				expect(result.taxAmount).toBe(0);
				expect(result.isBelowThreshold).toBe(true);
				expect(result.taxableRevenue).toBe(0);
			});

			it('should return 0 tax at exactly threshold (500M)', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 1,
					grossRevenue: 500_000_000,
					previousCumulativeRevenue: 0
				});

				expect(result.taxAmount).toBe(0);
				expect(result.isBelowThreshold).toBe(true);
			});

			it('should return 0.5% tax when cumulative exceeds threshold', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 2,
					grossRevenue: 10_000_000,
					previousCumulativeRevenue: 500_000_001 // Just over threshold
				});

				expect(result.taxAmount).toBe(50000); // 10M * 0.005 = 50,000
				expect(result.isBelowThreshold).toBe(false);
				expect(result.taxableRevenue).toBe(10_000_000);
			});

			it('should calculate partial tax when threshold crossed mid-month', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 6,
					grossRevenue: 100_000_000, // 100M
					previousCumulativeRevenue: 450_000_000 // Total would be 550M, so 50M above threshold
				});

				// Only 50M is taxable (550M - 500M)
				expect(result.taxAmount).toBe(250000); // 50M * 0.005 = 250,000
				expect(result.taxableRevenue).toBe(50_000_000);
				expect(result.isBelowThreshold).toBe(false);
			});

			it('should track cumulative revenue correctly', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 3,
					grossRevenue: 25_000_000,
					previousCumulativeRevenue: 100_000_000
				});

				expect(result.cumulativeRevenue).toBe(125_000_000);
			});
		});

		describe('WP Badan', () => {
			it('should always return 0.5% tax regardless of cumulative', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_BADAN,
					year: 2026,
					month: 1,
					grossRevenue: 1_000_000, // 1M
					previousCumulativeRevenue: 0
				});

				expect(result.taxAmount).toBe(5000); // 1M * 0.005 = 5,000
				expect(result.isBelowThreshold).toBe(false);
				expect(result.taxableRevenue).toBe(1_000_000);
			});

			it('should calculate tax on first month with zero previous revenue', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_BADAN,
					year: 2026,
					month: 1,
					grossRevenue: 500_000_000, // 500M
					previousCumulativeRevenue: 0
				});

				expect(result.taxAmount).toBe(2_500_000); // 500M * 0.005 = 2.5M
			});
		});

		describe('Edge cases', () => {
			it('should handle zero revenue', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 1,
					grossRevenue: 0,
					previousCumulativeRevenue: 0
				});

				expect(result.taxAmount).toBe(0);
				expect(result.taxableRevenue).toBe(0);
			});

			it('should handle negative revenue (should not happen but tests robustness)', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_OP,
					year: 2026,
					month: 1,
					grossRevenue: -100_000,
					previousCumulativeRevenue: 0
				});

				// Negative revenue effectively reduces cumulative
				expect(result.taxableRevenue).toBe(0);
				expect(result.cumulativeRevenue).toBe(0);
			});

			it('should floor tax amount (no decimals)', () => {
				const result = calculateMonthlyTax({
					userId: 'user1',
					taxpayerType: TAXPAYER_TYPE.WP_BADAN,
					year: 2026,
					month: 1,
					grossRevenue: 333_333, // Would be 1666.665 with decimal
					previousCumulativeRevenue: 0
				});

				// 333,333 * 0.005 = 1666.665, floored to 1666
				expect(result.taxAmount).toBe(1666);
			});
		});
	});

	describe('calculateAnnualTax', () => {
		it('should calculate full year for WP OP below threshold', () => {
			const monthlyRevenues = [
				{ month: 1, revenue: 10_000_000 },
				{ month: 2, revenue: 15_000_000 },
				{ month: 3, revenue: 20_000_000 },
				{ month: 4, revenue: 25_000_000 },
				{ month: 5, revenue: 30_000_000 },
				{ month: 6, revenue: 35_000_000 },
				{ month: 7, revenue: 40_000_000 },
				{ month: 8, revenue: 45_000_000 },
				{ month: 9, revenue: 50_000_000 },
				{ month: 10, revenue: 55_000_000 },
				{ month: 11, revenue: 60_000_000 },
				{ month: 12, revenue: 65_000_000 }
			];

			const result = calculateAnnualTax(monthlyRevenues, TAXPAYER_TYPE.WP_OP, 2026);

			expect(result.totalGrossRevenue).toBe(450_000_000);
			expect(result.totalTaxAmount).toBe(0);
			expect(result.thresholdExceeded).toBe(false);
		});

		it('should calculate tax when threshold exceeded mid-year', () => {
			const monthlyRevenues = [
				{ month: 1, revenue: 50_000_000 },
				{ month: 2, revenue: 50_000_000 },
				{ month: 3, revenue: 50_000_000 },
				{ month: 4, revenue: 50_000_000 },
				{ month: 5, revenue: 50_000_000 },
				{ month: 6, revenue: 50_000_000 },
				{ month: 7, revenue: 50_000_000 },
				{ month: 8, revenue: 50_000_000 },
				{ month: 9, revenue: 50_000_000 },
				{ month: 10, revenue: 50_000_000 },
				{ month: 11, revenue: 50_000_000 },
				{ month: 12, revenue: 50_000_000 }
			];
			// Total: 600M, threshold (500M) exceeded in month 11 (550M cumulative)

			const result = calculateAnnualTax(monthlyRevenues, TAXPAYER_TYPE.WP_OP, 2026);

			expect(result.totalGrossRevenue).toBe(600_000_000);
			expect(result.thresholdExceeded).toBe(true);
			expect(result.thresholdExceededMonth).toBe(11);

			// First 9 months: 450M = no tax
			// Month 10: 50M, taxable = 500M threshold, 0 taxable
			// Month 11: 50M, taxable = 50M
			// Month 12: 50M, taxable = 50M
			// Total taxable = 100M, tax = 500,000
			expect(result.totalTaxableRevenue).toBe(100_000_000);
			expect(result.totalTaxAmount).toBe(500_000);
		});

		it('should calculate full year tax for WP Badan', () => {
			const monthlyRevenues = [
				{ month: 1, revenue: 10_000_000 },
				{ month: 2, revenue: 15_000_000 },
				{ month: 3, revenue: 20_000_000 }
			];

			const result = calculateAnnualTax(monthlyRevenues, TAXPAYER_TYPE.WP_BADAN, 2026);

			expect(result.totalGrossRevenue).toBe(45_000_000);
			expect(result.totalTaxableRevenue).toBe(45_000_000);
			// 45M * 0.005 = 225,000
			expect(result.totalTaxAmount).toBe(225_000);
			expect(result.thresholdExceeded).toBe(false); // WP Badan doesn't use threshold
		});

		it('should handle sparse months (months with zero revenue)', () => {
			const monthlyRevenues = [
				{ month: 1, revenue: 100_000_000 },
				{ month: 2, revenue: 0 },
				{ month: 3, revenue: 0 },
				{ month: 4, revenue: 0 },
				{ month: 5, revenue: 450_000_000 } // Cumulative: 100M + 450M = 550M > 500M threshold
			];

			const result = calculateAnnualTax(monthlyRevenues, TAXPAYER_TYPE.WP_OP, 2026);

			// Only the excess above threshold (550M - 500M = 50M) is taxable
			expect(result.months[4].taxAmount).toBe(250_000); // 50M * 0.005
		});
	});

	describe('getThresholdInfo', () => {
		it('should return correct threshold info when below', () => {
			const info = getThresholdInfo(100_000_000);

			expect(info.threshold).toBe(500_000_000);
			expect(info.currentRevenue).toBe(100_000_000);
			expect(info.percentage).toBe(20);
			expect(info.isExceeded).toBe(false);
		});

		it('should return correct threshold info when above', () => {
			const info = getThresholdInfo(600_000_000);

			expect(info.percentage).toBe(100); // Capped at 100
			expect(info.isExceeded).toBe(true);
		});

		it('should cap percentage at 100', () => {
			const info = getThresholdInfo(1_000_000_000);

			expect(info.percentage).toBe(100);
		});
	});

	describe('getThresholdAlertLevel', () => {
		it('should return null below 80%', () => {
			expect(getThresholdAlertLevel(100_000_000)).toBeNull();
			expect(getThresholdAlertLevel(399_000_000)).toBeNull();
		});

		it('should return warning at 80% and above', () => {
			expect(getThresholdAlertLevel(400_000_000)).toBe('warning');
			expect(getThresholdAlertLevel(450_000_000)).toBe('warning');
		});

		it('should return critical at 100% and above', () => {
			expect(getThresholdAlertLevel(500_000_000)).toBe('critical');
			expect(getThresholdAlertLevel(600_000_000)).toBe('critical');
		});
	});

	describe('getThresholdColor', () => {
		it('should return green below 70%', () => {
			expect(getThresholdColor(0)).toBe('green');
			expect(getThresholdColor(69)).toBe('green');
		});

		it('should return yellow between 70% and 90%', () => {
			expect(getThresholdColor(70)).toBe('yellow');
			expect(getThresholdColor(89)).toBe('yellow');
		});

		it('should return red at 90% and above', () => {
			expect(getThresholdColor(90)).toBe('red');
			expect(getThresholdColor(100)).toBe('red');
		});
	});

	describe('calculateTax', () => {
		it('should calculate simple tax', () => {
			expect(calculateTax(100_000)).toBe(500); // 100K * 0.005
			expect(calculateTax(1_000_000)).toBe(5000); // 1M * 0.005
			expect(calculateTax(100_000_000)).toBe(500_000); // 100M * 0.005
		});

		it('should return 0 for zero or negative', () => {
			expect(calculateTax(0)).toBe(0);
			expect(calculateTax(-100_000)).toBe(0);
		});

		it('should floor result', () => {
			// 333 * 0.005 = 1.665, floored to 1
			expect(calculateTax(333)).toBe(1);
		});
	});

	describe('formatRupiah', () => {
		it('should format amounts correctly', () => {
			expect(formatRupiah(1000)).toContain('1.000');
			expect(formatRupiah(1000000)).toContain('1.000.000');
			expect(formatRupiah(100000000)).toContain('100.000.000');
		});

		it('should handle zero', () => {
			expect(formatRupiah(0)).toContain('0');
		});
	});
});
