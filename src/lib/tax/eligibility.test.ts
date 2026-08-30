import { describe, expect, it } from 'vitest';
import { TAX_LEGAL_FORM, TAX_REGIME_CHOICE, TAXPAYER_TYPE } from './config';
import {
	evaluateTaxEligibility,
	FINAL_REGIME_ANNUAL_LIMIT,
	getTaxRuleForYear
} from './eligibility';
import type { TaxProfileData } from './types';

function profile(overrides: Partial<TaxProfileData> = {}): TaxProfileData {
	return {
		taxYear: 2026,
		legalForm: TAX_LEGAL_FORM.INDIVIDUAL,
		registeredAt: '2024-01-10',
		finalRegimeStartYear: 2024,
		regimeChoice: TAX_REGIME_CHOICE.FINAL_UMKM,
		everUsedGeneralRegime: false,
		priorYearAggregatedRevenue: 300_000_000,
		externalMonthlyRevenue: Array(12).fill(0),
		revenueDataComplete: true,
		aggregationConfirmed: true,
		hasProfessionalServiceIncome: false,
		soleOwnerProvidesProfessionalServices: false,
		usesOtherTaxFacility: false,
		...overrides
	};
}

describe('versioned tax eligibility', () => {
	it('selects the rule by tax year', () => {
		expect(getTaxRuleForYear(2025).id).toBe('pp-55-2022');
		expect(getTaxRuleForYear(2026).id).toBe('pp-20-2026');
	});

	it('requires an explicit profile instead of defaulting to an individual', () => {
		const result = evaluateTaxEligibility(null, 2026, 100_000_000);
		expect(result.status).toBe('needs_information');
		expect(result.taxpayerType).toBeNull();
	});

	it('allows a complete individual profile under PP 20/2026', () => {
		const result = evaluateTaxEligibility(profile(), 2026, 600_000_000);
		expect(result.status).toBe('eligible');
		expect(result.taxpayerType).toBe(TAXPAYER_TYPE.WP_OP);
		expect(result.individualTurnoverFacility).toBe(true);
	});

	it('does not present a calculation after a general-regime election', () => {
		const result = evaluateTaxEligibility(
			profile({ everUsedGeneralRegime: true }),
			2026,
			100_000_000
		);
		expect(result.status).toBe('ineligible');
		expect(result.eligibleNextYear).toBe(false);
	});

	it('rejects a new ordinary limited company under PP 20/2026', () => {
		const result = evaluateTaxEligibility(
			profile({
				legalForm: TAX_LEGAL_FORM.LIMITED_COMPANY,
				registeredAt: '2026-05-01',
				finalRegimeStartYear: 2026
			}),
			2026,
			100_000_000
		);
		expect(result.status).toBe('ineligible');
		expect(result.taxpayerType).toBe(TAXPAYER_TYPE.WP_BADAN);
	});

	it('allows a legacy limited company only through its transition term', () => {
		const legacy = profile({
			legalForm: TAX_LEGAL_FORM.LIMITED_COMPANY,
			registeredAt: '2024-06-01',
			finalRegimeStartYear: 2024
		});
		expect(evaluateTaxEligibility(legacy, 2026, 100_000_000).status).toBe('eligible');
		expect(evaluateTaxEligibility({ ...legacy, taxYear: 2027 }, 2027, 100_000_000).status).toBe(
			'ineligible'
		);
	});

	it('keeps the final regime through the year when current turnover crosses Rp4.8b', () => {
		const result = evaluateTaxEligibility(profile(), 2026, FINAL_REGIME_ANNUAL_LIMIT + 1);
		expect(result.status).toBe('eligible');
		expect(result.currentYearTurnoverExceeded).toBe(true);
		expect(result.eligibleNextYear).toBe(false);
	});

	it('rejects a profile whose prior-year aggregate exceeds Rp4.8b', () => {
		const result = evaluateTaxEligibility(
			profile({ priorYearAggregatedRevenue: FINAL_REGIME_ANNUAL_LIMIT + 1 }),
			2026,
			100_000_000
		);
		expect(result.status).toBe('ineligible');
	});

	it('withholds an estimate when professional-service income cannot be separated', () => {
		const result = evaluateTaxEligibility(
			profile({ hasProfessionalServiceIncome: true }),
			2026,
			100_000_000
		);
		expect(result.status).toBe('needs_information');
	});
});
