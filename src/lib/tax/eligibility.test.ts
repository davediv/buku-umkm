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
		turnoverLimitExceeded: false,
		priorYearAggregatedRevenue: 300_000_000,
		externalMonthlyRevenue: Array(12).fill(0),
		revenueDataComplete: true,
		aggregationConfirmed: true,
		hasProfessionalServiceIncome: false,
		soleOwnerProvidesProfessionalServices: false,
		usesOtherTaxFacility: false,
		groupTurnoverExceeded: false,
		...overrides
	};
}

/** Evaluates the profile for `taxYear`, with the profile's own year set to match. */
function evaluate(overrides: Partial<TaxProfileData>, taxYear: number, revenue = 100_000_000) {
	return evaluateTaxEligibility(profile({ ...overrides, taxYear }), taxYear, revenue);
}

const company = (overrides: Partial<TaxProfileData> = {}): Partial<TaxProfileData> => ({
	legalForm: TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY,
	...overrides
});
const cooperative = (overrides: Partial<TaxProfileData> = {}): Partial<TaxProfileData> => ({
	legalForm: TAX_LEGAL_FORM.COOPERATIVE,
	...overrides
});

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

	it('keeps the final regime through the year when current turnover crosses Rp4.8b', () => {
		const result = evaluateTaxEligibility(profile(), 2026, FINAL_REGIME_ANNUAL_LIMIT + 1);
		expect(result.status).toBe('eligible');
		expect(result.currentYearTurnoverExceeded).toBe(true);
		expect(result.eligibleNextYear).toBe(false);
	});
});

describe('PP 20/2026 Pasal 56 ayat (3) huruf a and ayat (4): pekerjaan bebas', () => {
	it('withholds an individual estimate because pekerjaan bebas income is not final', () => {
		const result = evaluate({ hasProfessionalServiceIncome: true }, 2026);
		expect(result.status).toBe('needs_information');
		expect(result.reasons[0]).toContain('Pasal 56 ayat (3) huruf a');
	});

	it('does not apply the individual pekerjaan bebas question to a body', () => {
		const result = evaluate(
			company({
				registeredAt: '2023-02-01',
				finalRegimeStartYear: 2023,
				hasProfessionalServiceIncome: true
			}),
			2026
		);
		expect(result.status).toBe('eligible');
	});
});

describe('PP 20/2026 Pasal 57 ayat (1) and Pasal 58: subjects and turnover', () => {
	it('rejects a profile whose prior-year aggregate exceeds Rp4.8b', () => {
		const result = evaluate({ priorYearAggregatedRevenue: FINAL_REGIME_ANNUAL_LIMIT + 1 }, 2026);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 58 ayat (1)');
	});

	it('allows exactly Rp4.8b in the prior year', () => {
		expect(evaluate({ priorYearAggregatedRevenue: FINAL_REGIME_ANNUAL_LIMIT }, 2026).status).toBe(
			'eligible'
		);
	});

	it('rejects a form that is not a Pasal 57 ayat (1) subject', () => {
		expect(evaluate({ legalForm: TAX_LEGAL_FORM.OTHER }, 2026).status).toBe('ineligible');
	});
});

describe('PP 20/2026 deletes Pasal 59: no time limit from 2027', () => {
	it('keeps an individual whose PP 55 term ended in 2024 eligible in 2027 and later', () => {
		const individual = { registeredAt: '2016-05-01', finalRegimeStartYear: 2018 };
		expect(evaluate(individual, 2027).status).toBe('eligible');
		expect(evaluate(individual, 2035).status).toBe('eligible');
	});

	it('keeps a perseroan perorangan eligible in 2027 after its PP 55 term ended', () => {
		const result = evaluate(
			company({ registeredAt: '2021-06-01', finalRegimeStartYear: 2021 }),
			2027
		);
		expect(result.status).toBe('eligible');
		expect(result.reasons[1]).toContain('Pasal 57 ayat (1) huruf b');
	});
});

describe('PP 20/2026 Pasal 57 ayat (2)', () => {
	it('huruf a, ayat (3)-(4): a general-regime election is permanent', () => {
		const result = evaluate({ everUsedGeneralRegime: true }, 2026);
		expect(result.status).toBe('ineligible');
		expect(result.eligibleNextYear).toBe(false);
		expect(evaluate({ regimeChoice: TAX_REGIME_CHOICE.GENERAL }, 2027).status).toBe('ineligible');
	});

	it('huruf b: rejects a perseroan perorangan of an expert from 2027', () => {
		const result = evaluate(
			company({
				registeredAt: '2023-02-01',
				finalRegimeStartYear: 2023,
				soleOwnerProvidesProfessionalServices: true
			}),
			2027
		);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 57 ayat (2) huruf b');
	});

	it('huruf b: rejects an expert perseroan perorangan founded after 22 April 2026', () => {
		const result = evaluate(
			company({
				registeredAt: '2026-06-01',
				finalRegimeStartYear: 2026,
				soleOwnerProvidesProfessionalServices: true
			}),
			2026
		);
		expect(result.status).toBe('ineligible');
	});

	it('huruf c: rejects a body with a Pasal 31A, PP 94/2010 or KEK facility', () => {
		const result = evaluate(
			cooperative({
				registeredAt: '2026-06-01',
				finalRegimeStartYear: 2026,
				usesOtherTaxFacility: true
			}),
			2026
		);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 57 ayat (2) huruf c');
	});

	it('huruf d: rejects a permanent establishment', () => {
		const result = evaluate({ legalForm: TAX_LEGAL_FORM.PERMANENT_ESTABLISHMENT }, 2026);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('huruf d');
	});

	it('huruf e, ayat (4): rejects a founder group that passed Rp4.8b, from 2027', () => {
		const result = evaluate({ groupTurnoverExceeded: true }, 2027);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 57 ayat (2) huruf e');
		expect(evaluate(company({ groupTurnoverExceeded: true }), 2028).status).toBe('ineligible');
	});

	it('huruf e: fails closed until the founder-group question is answered', () => {
		const result = evaluate({ groupTurnoverExceeded: null }, 2027);
		expect(result.status).toBe('needs_information');
		expect(result.reasons[0]).toContain('huruf e');
	});

	it('huruf f: limits a koperasi registered after 22 April 2026 to 4 tax years', () => {
		const koperasi = cooperative({ registeredAt: '2026-06-01', finalRegimeStartYear: 2026 });
		expect(evaluate(koperasi, 2026).status).toBe('eligible');
		const lastYear = evaluate(koperasi, 2029);
		expect(lastYear.status).toBe('eligible');
		expect(lastYear.eligibleNextYear).toBe(false);
		const after = evaluate(koperasi, 2030);
		expect(after.status).toBe('ineligible');
		expect(after.reasons[0]).toContain('Pasal 57 ayat (2) huruf f');
	});
});

describe('PP 20/2026 Pasal II angka 1: transition', () => {
	it('huruf a butir 1): extends an individual whose PP 55 term ended in 2024 to 2025 and 2026', () => {
		const individual = { registeredAt: '2016-05-01', finalRegimeStartYear: 2018 };
		const in2025 = evaluate(individual, 2025);
		expect(in2025.status).toBe('eligible');
		expect(in2025.rule.id).toBe('pp-20-2026');
		expect(in2025.reasons[1]).toContain('huruf a butir 1)');
		expect(evaluate(individual, 2026).status).toBe('eligible');
	});

	it('huruf a butir 2): extends a perseroan perorangan whose PP 55 term ended in 2025 to 2026', () => {
		const result = evaluate(
			company({ registeredAt: '2022-03-01', finalRegimeStartYear: 2022 }),
			2026
		);
		expect(result.status).toBe('eligible');
		expect(result.reasons[1]).toContain('huruf a butir 2)');
	});

	it('gives a perseroan perorangan whose PP 55 term ended in 2024 nothing for 2025', () => {
		const result = evaluate(
			company({ registeredAt: '2021-06-01', finalRegimeStartYear: 2021 }),
			2025
		);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 59 PP 55/2022');
	});

	it('fails closed for 2026 when no transition rule covers January to 21 April', () => {
		const result = evaluate(
			company({ registeredAt: '2021-06-01', finalRegimeStartYear: 2021 }),
			2026
		);
		expect(result.status).toBe('needs_information');
		expect(result.reasons[0]).toContain('22 April 2026');
	});

	it('huruf b: keeps a koperasi whose PP 55 term ends in 2024-2029 through 2029', () => {
		const koperasi = cooperative({ registeredAt: '2021-03-01', finalRegimeStartYear: 2021 });
		const in2025 = evaluate(koperasi, 2025);
		expect(in2025.status).toBe('eligible');
		expect(in2025.rule.id).toBe('pp-20-2026');
		expect(evaluate(koperasi, 2029).status).toBe('eligible');
		expect(evaluate(koperasi, 2029).eligibleNextYear).toBe(false);
		expect(evaluate(koperasi, 2030).status).toBe('ineligible');
	});

	it('huruf b: does not revive a koperasi whose PP 55 term ended before 2024', () => {
		const koperasi = cooperative({ registeredAt: '2019-03-01', finalRegimeStartYear: 2019 });
		expect(evaluate(koperasi, 2026).status).toBe('ineligible');
	});

	it('huruf e: keeps a legacy PT, CV, firma or BUM Desa only until its PP 55 term ends', () => {
		const legacyPt = {
			legalForm: TAX_LEGAL_FORM.LIMITED_COMPANY,
			registeredAt: '2024-06-01',
			finalRegimeStartYear: 2024
		};
		expect(evaluate(legacyPt, 2026).status).toBe('eligible');
		expect(evaluate(legacyPt, 2026).eligibleNextYear).toBe(false);
		expect(evaluate(legacyPt, 2027).status).toBe('ineligible');

		const legacyCv = {
			legalForm: TAX_LEGAL_FORM.CV,
			registeredAt: '2024-01-15',
			finalRegimeStartYear: 2024
		};
		expect(evaluate(legacyCv, 2027).status).toBe('eligible');
		expect(evaluate(legacyCv, 2027).reasons[1]).toContain('Pasal II angka 1 huruf e');
		expect(evaluate(legacyCv, 2028).status).toBe('ineligible');
	});

	it('huruf e: rejects a CV, firma, PT or BUM Desa registered from 22 April 2026', () => {
		const result = evaluate(
			{
				legalForm: TAX_LEGAL_FORM.LIMITED_COMPANY,
				registeredAt: '2026-05-01',
				finalRegimeStartYear: 2026
			},
			2026
		);
		expect(result.status).toBe('ineligible');
		expect(result.taxpayerType).toBe(TAXPAYER_TYPE.WP_BADAN);
	});

	it('huruf e with PP 55 criteria: rejects a CV formed by experts', () => {
		const result = evaluate(
			{
				legalForm: TAX_LEGAL_FORM.CV,
				registeredAt: '2024-01-15',
				finalRegimeStartYear: 2024,
				soleOwnerProvidesProfessionalServices: true
			},
			2026
		);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('PP 55/2022');
	});

	it('huruf f: lets a founder group that passed Rp4.8b finish 2026 under the final rate', () => {
		const result = evaluate({ groupTurnoverExceeded: true }, 2026);
		expect(result.status).toBe('eligible');
		expect(result.eligibleNextYear).toBe(false);
		expect(result.reasons[1]).toContain('Pasal II angka 1 huruf f');
	});

	it('huruf f: lets an expert perseroan perorangan under PP 55 finish 2026', () => {
		const result = evaluate(
			company({
				registeredAt: '2023-02-01',
				finalRegimeStartYear: 2023,
				soleOwnerProvidesProfessionalServices: true
			}),
			2026
		);
		expect(result.status).toBe('eligible');
		expect(result.eligibleNextYear).toBe(false);
	});

	it('PP 55 did not exclude an expert perseroan perorangan in 2025', () => {
		const result = evaluate(
			company({
				registeredAt: '2023-02-01',
				finalRegimeStartYear: 2023,
				soleOwnerProvidesProfessionalServices: true
			}),
			2025
		);
		expect(result.status).toBe('eligible');
		expect(result.rule.id).toBe('pp-55-2022');
	});
});

describe('PP 55/2022 Pasal 60 ayat (2): Rp500 juta for individuals (not amended)', () => {
	it('keeps the Rp500 juta facility for individuals in later years', () => {
		const result = evaluate({}, 2027);
		expect(result.individualTurnoverFacility).toBe(true);
		expect(result.reasons.at(-1)).toContain('Pasal 60 ayat (2) PP 55/2022');
	});

	it('does not give the Rp500 juta facility to a body', () => {
		const result = evaluate(
			company({ registeredAt: '2023-02-01', finalRegimeStartYear: 2023 }),
			2027
		);
		expect(result.individualTurnoverFacility).toBe(false);
	});
});

describe('chose the Pasal 17 rates vs. turnover that passed Rp4,8 miliar', () => {
	it('keeps choosing the Pasal 17 rates permanent for every legal form', () => {
		const koperasi = cooperative({
			registeredAt: '2026-06-01',
			finalRegimeStartYear: 2026,
			everUsedGeneralRegime: true
		});
		const result = evaluate(koperasi, 2027);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 57 ayat (2) huruf a');
	});

	it('ends the final rate after the turnover passed Rp4,8 miliar, koperasi included (Pasal 61)', () => {
		const koperasi = cooperative({
			registeredAt: '2026-06-01',
			finalRegimeStartYear: 2026,
			turnoverLimitExceeded: true,
			priorYearAggregatedRevenue: 1_000_000_000
		});
		const result = evaluate(koperasi, 2027);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 61 ayat (2) PP 55/2022');
	});

	it('applies the same rule before PP 20/2026 and to a CV on the transition', () => {
		expect(evaluate({ turnoverLimitExceeded: true }, 2025).status).toBe('ineligible');
		const cv = evaluate(
			{
				legalForm: TAX_LEGAL_FORM.CV,
				registeredAt: '2024-01-15',
				finalRegimeStartYear: 2024,
				turnoverLimitExceeded: true
			},
			2027
		);
		expect(cv.status).toBe('ineligible');
		expect(cv.reasons[0]).toContain('Pasal 61');
	});

	it("gives an individual's own excess no 2026 grace: Pasal II angka 1 huruf f covers only huruf e", () => {
		// Registered before PP 20/2026 with a PP 55 term that covers 2026, so the founder-group
		// rule alone would still allow 2026.
		const individual = { registeredAt: '2020-03-01', finalRegimeStartYear: 2020 };
		expect(evaluate({ ...individual, groupTurnoverExceeded: true }, 2026).status).toBe('eligible');
		const result = evaluate({ ...individual, turnoverLimitExceeded: true }, 2026);
		expect(result.status).toBe('ineligible');
		expect(result.reasons[0]).toContain('Pasal 61');
	});
});
