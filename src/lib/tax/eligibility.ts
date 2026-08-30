import {
	TAX_LEGAL_FORM,
	TAX_REGIME_CHOICE,
	TAXPAYER_TYPE,
	REVENUE_THRESHOLD_WP_OP
} from './config';
import type {
	TaxEligibilityDecision,
	TaxLegalForm,
	TaxProfileData,
	TaxRuleVersion,
	TaxpayerType
} from './types';

export const FINAL_REGIME_ANNUAL_LIMIT = 4_800_000_000;
export const PP20_EFFECTIVE_DATE = '2026-04-22';

export const TAX_RULE_VERSIONS: readonly TaxRuleVersion[] = [
	{
		id: 'pp-23-2018',
		name: 'PP 23 Tahun 2018',
		effectiveFrom: '2018-07-01',
		effectiveTo: '2022-12-19',
		taxYearFrom: 2018,
		taxYearTo: 2021,
		sourceUrl: 'https://peraturan.bpk.go.id/Details/82680/pp-no-23-tahun-2018'
	},
	{
		id: 'pp-55-2022',
		name: 'PP 55 Tahun 2022',
		effectiveFrom: '2022-12-20',
		effectiveTo: '2026-04-21',
		taxYearFrom: 2022,
		taxYearTo: 2025,
		sourceUrl:
			'https://jdih.kemenkeu.go.id/download/cab6ec99-3dbc-47c6-adbf-ea5f0f7117d6/55TAHUN2022PP.pdf'
	},
	{
		id: 'pp-20-2026',
		name: 'PP 20 Tahun 2026',
		effectiveFrom: PP20_EFFECTIVE_DATE,
		effectiveTo: null,
		taxYearFrom: 2026,
		taxYearTo: null,
		sourceUrl:
			'https://www.pajak.go.id/id/peraturan/perubahan-atas-peraturan-pemerintah-nomor-55-tahun-2022-tentang-penyesuaian-pengaturan-0'
	}
] as const;

const BODY_FORMS = new Set<TaxLegalForm>([
	TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY,
	TAX_LEGAL_FORM.COOPERATIVE,
	TAX_LEGAL_FORM.CV,
	TAX_LEGAL_FORM.FIRM,
	TAX_LEGAL_FORM.LIMITED_COMPANY,
	TAX_LEGAL_FORM.VILLAGE_ENTERPRISE,
	TAX_LEGAL_FORM.PERMANENT_ESTABLISHMENT,
	TAX_LEGAL_FORM.OTHER
]);

const PP55_DURATION: Partial<Record<TaxLegalForm, number>> = {
	[TAX_LEGAL_FORM.INDIVIDUAL]: 7,
	[TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY]: 4,
	[TAX_LEGAL_FORM.COOPERATIVE]: 4,
	[TAX_LEGAL_FORM.CV]: 4,
	[TAX_LEGAL_FORM.FIRM]: 4,
	[TAX_LEGAL_FORM.VILLAGE_ENTERPRISE]: 4,
	[TAX_LEGAL_FORM.LIMITED_COMPANY]: 3
};

export function getTaxRuleForYear(taxYear: number): TaxRuleVersion {
	return (
		TAX_RULE_VERSIONS.find(
			(rule) =>
				taxYear >= rule.taxYearFrom && (rule.taxYearTo === null || taxYear <= rule.taxYearTo)
		) ?? TAX_RULE_VERSIONS[TAX_RULE_VERSIONS.length - 1]
	);
}

export function getTaxpayerTypeForLegalForm(legalForm: TaxLegalForm): TaxpayerType {
	return legalForm === TAX_LEGAL_FORM.INDIVIDUAL ? TAXPAYER_TYPE.WP_OP : TAXPAYER_TYPE.WP_BADAN;
}

function isWithinFinalRegimeTerm(profile: TaxProfileData, taxYear: number): boolean {
	const duration = PP55_DURATION[profile.legalForm];
	if (!duration) return false;
	return taxYear <= profile.finalRegimeStartYear + duration - 1;
}

function baseDecision(
	profile: TaxProfileData | null,
	taxYear: number,
	currentYearAggregatedRevenue: number
): TaxEligibilityDecision {
	const rule = getTaxRuleForYear(taxYear);
	const taxpayerType = profile ? getTaxpayerTypeForLegalForm(profile.legalForm) : null;
	const individualTurnoverFacility =
		taxYear >= 2022 && profile?.legalForm === TAX_LEGAL_FORM.INDIVIDUAL;
	const currentYearTurnoverExceeded = currentYearAggregatedRevenue > FINAL_REGIME_ANNUAL_LIMIT;

	return {
		status: 'needs_information',
		reasons: [],
		rule,
		taxpayerType,
		individualTurnoverFacility,
		currentYearTurnoverExceeded,
		eligibleNextYear: !currentYearTurnoverExceeded
	};
}

/**
 * Determines whether Buku UMKM may show a PPh Final 0.5% estimate.
 * It deliberately fails closed: incomplete or mixed-income profiles do not
 * receive a liability amount.
 */
export function evaluateTaxEligibility(
	profile: TaxProfileData | null,
	taxYear: number,
	currentYearAggregatedRevenue: number
): TaxEligibilityDecision {
	const decision = baseDecision(profile, taxYear, currentYearAggregatedRevenue);

	if (!profile) {
		decision.reasons.push(`Lengkapi profil pajak untuk tahun ${taxYear} sebelum membuat estimasi.`);
		return decision;
	}

	if (taxYear < 2022) {
		decision.reasons.push(
			'Estimasi otomatis sebelum tahun pajak 2022 tidak didukung; tinjau aturan historis secara manual.'
		);
		return decision;
	}

	if (profile.taxYear !== taxYear) {
		decision.reasons.push('Profil pajak tidak sesuai dengan tahun yang dihitung.');
		return decision;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.registeredAt)) {
		decision.reasons.push('Tanggal pendaftaran wajib pajak belum valid.');
		return decision;
	}

	if (!profile.revenueDataComplete || !profile.aggregationConfirmed) {
		decision.reasons.push(
			'Konfirmasikan bahwa omzet usaha, pasangan, dan perseroan perseorangan terkait sudah digabungkan.'
		);
		return decision;
	}

	if (profile.externalMonthlyRevenue.length !== 12) {
		decision.reasons.push('Omzet di luar Buku UMKM harus diisi untuk setiap bulan.');
		return decision;
	}

	if (
		profile.externalMonthlyRevenue.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
	) {
		decision.reasons.push(
			'Omzet bulanan di luar Buku UMKM harus berupa Rupiah utuh dan tidak negatif.'
		);
		return decision;
	}

	if (profile.regimeChoice === TAX_REGIME_CHOICE.GENERAL || profile.everUsedGeneralRegime) {
		decision.status = 'ineligible';
		decision.eligibleNextYear = false;
		decision.reasons.push(
			'Tarif umum telah dipilih/digunakan dan tarif final UMKM tidak dapat dipilih kembali.'
		);
		return decision;
	}

	if (profile.priorYearAggregatedRevenue > FINAL_REGIME_ANNUAL_LIMIT) {
		decision.status = 'ineligible';
		decision.eligibleNextYear = false;
		decision.reasons.push('Omzet agregat tahun sebelumnya melebihi Rp4,8 miliar.');
		return decision;
	}

	if (profile.usesOtherTaxFacility) {
		decision.status = 'ineligible';
		decision.reasons.push(
			'Wajib pajak menggunakan fasilitas Pajak Penghasilan lain yang mengecualikan tarif final UMKM.'
		);
		return decision;
	}

	if (profile.hasProfessionalServiceIncome) {
		decision.reasons.push(
			'Penghasilan pekerjaan bebas tidak dapat dipisahkan otomatis dari omzet usaha; minta penelaahan profesional.'
		);
		return decision;
	}

	if (
		profile.legalForm === TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY &&
		profile.soleOwnerProvidesProfessionalServices
	) {
		decision.status = 'ineligible';
		decision.reasons.push(
			'Perseroan perseorangan milik tenaga ahli yang memberi jasa sejenis tidak memenuhi fasilitas ini.'
		);
		return decision;
	}

	if (
		profile.legalForm === TAX_LEGAL_FORM.PERMANENT_ESTABLISHMENT ||
		profile.legalForm === TAX_LEGAL_FORM.OTHER
	) {
		decision.status = 'ineligible';
		decision.reasons.push(
			'Bentuk wajib pajak ini tidak termasuk subjek tarif final UMKM yang didukung.'
		);
		return decision;
	}

	if (decision.rule.id === 'pp-20-2026') {
		const directlyEligible =
			profile.legalForm === TAX_LEGAL_FORM.INDIVIDUAL ||
			profile.legalForm === TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY;
		const cooperativeEligible =
			profile.legalForm === TAX_LEGAL_FORM.COOPERATIVE && isWithinFinalRegimeTerm(profile, taxYear);
		const transitionalForms: readonly TaxLegalForm[] = [
			TAX_LEGAL_FORM.CV,
			TAX_LEGAL_FORM.FIRM,
			TAX_LEGAL_FORM.LIMITED_COMPANY,
			TAX_LEGAL_FORM.VILLAGE_ENTERPRISE
		];
		const transitionalBodyEligible =
			profile.registeredAt < PP20_EFFECTIVE_DATE &&
			transitionalForms.includes(profile.legalForm) &&
			isWithinFinalRegimeTerm(profile, taxYear);

		if (!directlyEligible && !cooperativeEligible && !transitionalBodyEligible) {
			decision.status = 'ineligible';
			decision.reasons.push(
				'Bentuk badan atau jangka waktu fasilitas tidak memenuhi ketentuan PP 20 Tahun 2026.'
			);
			return decision;
		}
	} else {
		if (!isWithinFinalRegimeTerm(profile, taxYear)) {
			decision.status = 'ineligible';
			decision.reasons.push('Jangka waktu penggunaan tarif final UMKM telah berakhir.');
			return decision;
		}
	}

	decision.status = 'eligible';
	decision.reasons.push(`Estimasi menggunakan ${decision.rule.name}.`);
	if (decision.currentYearTurnoverExceeded) {
		decision.reasons.push(
			'Omzet tahun berjalan telah melewati Rp4,8 miliar; tarif final tetap berlaku sampai akhir tahun ini dan tidak berlaku tahun berikutnya.'
		);
	}
	if (decision.individualTurnoverFacility) {
		decision.reasons.push(
			`Bagian omzet usaha kumulatif sampai Rp${REVENUE_THRESHOLD_WP_OP.toLocaleString('id-ID')} tidak dikenai PPh Final.`
		);
	}

	return decision;
}

export function isBodyLegalForm(legalForm: TaxLegalForm): boolean {
	return BODY_FORMS.has(legalForm);
}
