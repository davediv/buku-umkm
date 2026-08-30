/**
 * Tax Engine Types
 *
 * Type definitions for PPh Final 0.5% tax calculations
 */

import type {
	TAX_LEGAL_FORM,
	TAX_REGIME_CHOICE,
	TAX_TYPE,
	TAX_STATUS,
	TAXPAYER_TYPE
} from './config';

export type TaxType = (typeof TAX_TYPE)[keyof typeof TAX_TYPE];
export type TaxStatus = (typeof TAX_STATUS)[keyof typeof TAX_STATUS];
export type TaxpayerType = (typeof TAXPAYER_TYPE)[keyof typeof TAXPAYER_TYPE];
export type TaxLegalForm = (typeof TAX_LEGAL_FORM)[keyof typeof TAX_LEGAL_FORM];
export type TaxRegimeChoice = (typeof TAX_REGIME_CHOICE)[keyof typeof TAX_REGIME_CHOICE];

export interface TaxProfileData {
	id?: string;
	taxYear: number;
	legalForm: TaxLegalForm;
	registeredAt: string;
	finalRegimeStartYear: number;
	regimeChoice: TaxRegimeChoice;
	everUsedGeneralRegime: boolean;
	priorYearAggregatedRevenue: number;
	externalMonthlyRevenue: number[];
	revenueDataComplete: boolean;
	aggregationConfirmed: boolean;
	hasProfessionalServiceIncome: boolean;
	soleOwnerProvidesProfessionalServices: boolean;
	usesOtherTaxFacility: boolean;
}

export type TaxEligibilityStatus = 'eligible' | 'ineligible' | 'needs_information';

export interface TaxRuleVersion {
	id: string;
	name: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	taxYearFrom: number;
	taxYearTo: number | null;
	sourceUrl: string;
}

export interface TaxEligibilityDecision {
	status: TaxEligibilityStatus;
	reasons: string[];
	rule: TaxRuleVersion;
	taxpayerType: TaxpayerType | null;
	individualTurnoverFacility: boolean;
	currentYearTurnoverExceeded: boolean;
	eligibleNextYear: boolean;
}

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
