/**
 * Tax Engine Types
 *
 * Type definitions for PPh Final 0.5% tax calculations
 */

import type { TAX_TYPE, TAX_STATUS, TAXPAYER_TYPE } from './config';

export type TaxType = (typeof TAX_TYPE)[keyof typeof TAX_TYPE];
export type TaxStatus = (typeof TAX_STATUS)[keyof typeof TAX_STATUS];
export type TaxpayerType = (typeof TAXPAYER_TYPE)[keyof typeof TAXPAYER_TYPE];

/**
 * Monthly tax calculation result
 */
export interface MonthlyTaxCalculation {
	year: number;
	month: number;
	grossRevenue: number;
	taxableRevenue: number;
	taxRate: number;
	taxAmount: number;
	isBelowThreshold: boolean;
	thresholdAmount: number;
	cumulativeRevenue: number;
	thresholdPercentage: number;
}

/**
 * Annual tax summary
 */
export interface AnnualTaxSummary {
	year: number;
	taxpayerType: TaxpayerType;
	totalGrossRevenue: number;
	totalTaxableRevenue: number;
	totalTaxAmount: number;
	months: MonthlyTaxCalculation[];
	thresholdExceeded: boolean;
	thresholdExceededMonth?: number;
}

/**
 * Tax calculation input
 */
export interface TaxCalculationInput {
	userId: string;
	taxpayerType: TaxpayerType;
	year: number;
	month: number;
	grossRevenue: number;
	previousCumulativeRevenue: number;
}

/**
 * Tax record for database
 */
export interface TaxRecordData {
	id?: string;
	userId: string;
	year: number;
	month: number;
	taxType: TaxType;
	taxableIncome: number;
	taxRate: number;
	taxAmount: number;
	status: TaxStatus;
	billingCode?: string;
	paymentDate?: string;
	notes?: string;
}

/**
 * Tax threshold info
 */
export interface ThresholdInfo {
	threshold: number;
	currentRevenue: number;
	percentage: number;
	isExceeded: boolean;
	exceededMonth?: number;
}
