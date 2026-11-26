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

/**
 * Turnover ceiling of Pasal 57 ayat (1) PP 55/2022 as amended by PP 20/2026, tested on the
 * previous tax year's gross turnover (Pasal 58 ayat (1)).
 */
export const FINAL_REGIME_ANNUAL_LIMIT = 4_800_000_000;
/** PP 20/2026 was enacted, promulgated (LN 2026 No. 43) and took effect on 22 April 2026. */
export const PP20_EFFECTIVE_DATE = '2026-04-22';
/** First tax year assessed under PP 55/2022 as amended by PP 20/2026. */
const PP20_FIRST_TAX_YEAR = 2026;

const PP20_RULE_ID = 'pp-20-2026';

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
		id: PP20_RULE_ID,
		name: 'PP 20 Tahun 2026',
		effectiveFrom: PP20_EFFECTIVE_DATE,
		effectiveTo: null,
		taxYearFrom: PP20_FIRST_TAX_YEAR,
		taxYearTo: null,
		sourceUrl:
			'https://www.pajak.go.id/id/peraturan/perubahan-atas-peraturan-pemerintah-nomor-55-tahun-2022-tentang-penyesuaian-pengaturan-0'
	}
] as const;

const PP20_RULE = TAX_RULE_VERSIONS.find((rule) => rule.id === PP20_RULE_ID)!;

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

/**
 * CV, firma, PT other than perseroan perorangan, and BUM Desa: no longer subjects of
 * Pasal 57 ayat (1) after PP 20/2026, but keep a PP 55/2022 term that has not ended
 * (Pasal II angka 1 huruf e).
 */
const TRANSITIONAL_BODY_FORMS = new Set<TaxLegalForm>([
	TAX_LEGAL_FORM.CV,
	TAX_LEGAL_FORM.FIRM,
	TAX_LEGAL_FORM.LIMITED_COMPANY,
	TAX_LEGAL_FORM.VILLAGE_ENTERPRISE
]);

/** Forms whose founders' expertise can exclude them (see expertServiceExclusionApplies). */
const EXPERT_SERVICE_FORMS = new Set<TaxLegalForm>([
	TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY,
	TAX_LEGAL_FORM.CV,
	TAX_LEGAL_FORM.FIRM
]);

/** Forms tested together with their founder under Pasal 57 ayat (2) huruf e PP 20/2026. */
const FOUNDER_GROUP_FORMS = new Set<TaxLegalForm>([
	TAX_LEGAL_FORM.INDIVIDUAL,
	TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY
]);

/**
 * The time limits of Pasal 59 ayat (1) PP 55/2022: 7 tax years for individuals, 4 for
 * koperasi, CV, firma, BUM Desa and perseroan perorangan, 3 for PT. PP 20/2026 deletes
 * Pasal 59, but its transition rules (Pasal II angka 1) are still keyed to when this
 * term ended.
 */
const PP55_TERM_YEARS: Partial<Record<TaxLegalForm, number>> = {
	[TAX_LEGAL_FORM.INDIVIDUAL]: 7,
	[TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY]: 4,
	[TAX_LEGAL_FORM.COOPERATIVE]: 4,
	[TAX_LEGAL_FORM.CV]: 4,
	[TAX_LEGAL_FORM.FIRM]: 4,
	[TAX_LEGAL_FORM.VILLAGE_ENTERPRISE]: 4,
	[TAX_LEGAL_FORM.LIMITED_COMPANY]: 3
};

const PP55_TERM_LABEL = 'Pasal 59 PP 55/2022';

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

export function isBodyLegalForm(legalForm: TaxLegalForm): boolean {
	return BODY_FORMS.has(legalForm);
}

/** Whether the profile asks about founders delivering pekerjaan-bebas-like services. */
export function asksExpertServiceQuestion(legalForm: TaxLegalForm): boolean {
	return EXPERT_SERVICE_FORMS.has(legalForm);
}

/** Whether the profile asks the founder-group turnover question (Pasal 57 ayat (2) huruf e). */
export function asksFounderGroupQuestion(legalForm: TaxLegalForm): boolean {
	return FOUNDER_GROUP_FORMS.has(legalForm);
}

type Outcome =
	| {
			status: 'eligible';
			/** The provision that allows the final rate this year, cited for the user. */
			basis: string;
			/** Set when a PP 20/2026 provision, not the year's default rule, grants the rate. */
			rule?: TaxRuleVersion;
			/** Last tax year this basis covers, when it is known to end. */
			lastYear?: number;
	  }
	| { status: 'ineligible' | 'needs_information'; reason: string };

type EligibleOutcome = Extract<Outcome, { status: 'eligible' }>;

const eligible = (
	basis: string,
	extra: Pick<EligibleOutcome, 'rule' | 'lastYear'> = {}
): Outcome => ({
	status: 'eligible',
	basis,
	...extra
});
const ineligible = (reason: string): Outcome => ({ status: 'ineligible', reason });
const needsInformation = (reason: string): Outcome => ({ status: 'needs_information', reason });

function pp55TermEnd(profile: TaxProfileData): number | null {
	const years = PP55_TERM_YEARS[profile.legalForm];
	return years ? profile.finalRegimeStartYear + years - 1 : null;
}

/** The last tax year a PP 55 term leads to once the PP 20/2026 transition rules apply. */
function pp55LastYear(profile: TaxProfileData, termEnd: number): number | undefined {
	switch (profile.legalForm) {
		// Pasal II angka 1 huruf a reaches 2026, after which Pasal 59 no longer exists.
		case TAX_LEGAL_FORM.INDIVIDUAL:
			return termEnd >= 2024 ? undefined : termEnd;
		case TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY:
			return termEnd >= 2025 ? undefined : termEnd;
		// Pasal II angka 1 huruf b.
		case TAX_LEGAL_FORM.COOPERATIVE:
			return termEnd >= 2024 ? 2029 : termEnd;
		default:
			return termEnd;
	}
}

function pp55TermText(profile: TaxProfileData, termEnd: number): string {
	return `jangka waktu ${PP55_TERM_YEARS[profile.legalForm]} tahun pajak menurut ${PP55_TERM_LABEL} (${profile.finalRegimeStartYear}–${termEnd})`;
}

const registeredBeforePp20 = (profile: TaxProfileData) =>
	profile.registeredAt < PP20_EFFECTIVE_DATE;

const registrationYear = (profile: TaxProfileData) => Number(profile.registeredAt.slice(0, 4));

/**
 * The PP 55/2022 rules for tax years 2022–2025, plus the PP 20/2026 transition rules that
 * reach back to tax year 2025 (Pasal II angka 1 huruf a butir 1) and huruf b).
 */
function pp55Outcome(profile: TaxProfileData, taxYear: number): Outcome {
	const termEnd = pp55TermEnd(profile);
	if (termEnd === null) return ineligible('Bentuk wajib pajak ini tidak termasuk PP 55/2022.');

	if (
		(profile.legalForm === TAX_LEGAL_FORM.CV || profile.legalForm === TAX_LEGAL_FORM.FIRM) &&
		profile.soleOwnerProvidesProfessionalServices
	) {
		return ineligible(
			'CV atau firma yang dibentuk oleh orang pribadi berkeahlian khusus dan menyerahkan jasa sejenis jasa pekerjaan bebas tidak termasuk wajib pajak tarif final (Pasal 57 ayat (2) huruf b PP 55/2022).'
		);
	}

	if (taxYear <= termEnd) {
		return eligible(`Masih dalam ${pp55TermText(profile, termEnd)}.`, {
			lastYear: pp55LastYear(profile, termEnd)
		});
	}

	if (taxYear === 2025) {
		if (profile.legalForm === TAX_LEGAL_FORM.INDIVIDUAL && termEnd === 2024) {
			return eligible(
				'Jangka waktu PP 55/2022 Anda berakhir pada Tahun Pajak 2024; Pasal II angka 1 huruf a butir 1) PP 20/2026 memperpanjang tarif final untuk Tahun Pajak 2025 dan 2026.',
				{ rule: PP20_RULE }
			);
		}
		if (
			profile.legalForm === TAX_LEGAL_FORM.COOPERATIVE &&
			registeredBeforePp20(profile) &&
			termEnd >= 2024
		) {
			return eligible(
				`Jangka waktu PP 55/2022 koperasi berakhir pada Tahun Pajak ${termEnd}; Pasal II angka 1 huruf b PP 20/2026 memberlakukan tarif final untuk Tahun Pajak 2025 sampai dengan 2029.`,
				{ rule: PP20_RULE, lastYear: 2029 }
			);
		}
	}

	return ineligible(
		`Jangka waktu tarif final menurut ${PP55_TERM_LABEL} berakhir pada Tahun Pajak ${termEnd}${taxYear === 2025 ? ', dan PP 20/2026 tidak memperpanjangnya untuk Tahun Pajak 2025 bagi bentuk ini' : ''}.`
	);
}

/**
 * Why an individual or perseroan perorangan was under the final rate per PP 55/2022 for tax
 * year 2026: its PP 55 term covers 2026, or Pasal II angka 1 huruf a extends it to 2026.
 * Null when neither applies.
 */
function pp55BasisFor2026(profile: TaxProfileData): string | null {
	const termEnd = pp55TermEnd(profile);
	if (termEnd === null) return null;
	if (termEnd >= 2026) {
		return `Memenuhi Pasal 57 ayat (1) PP 55/2022 sebagaimana diubah PP 20/2026; ${pp55TermText(profile, termEnd)} juga mencakup awal 2026.`;
	}
	if (termEnd === 2025) {
		return 'Jangka waktu PP 55/2022 berakhir pada Tahun Pajak 2025; Pasal II angka 1 huruf a butir 2) PP 20/2026 memberlakukan tarif final untuk Tahun Pajak 2026.';
	}
	if (termEnd === 2024 && profile.legalForm === TAX_LEGAL_FORM.INDIVIDUAL) {
		return 'Jangka waktu PP 55/2022 berakhir pada Tahun Pajak 2024; Pasal II angka 1 huruf a butir 1) PP 20/2026 memberlakukan tarif final untuk Tahun Pajak 2025 dan 2026.';
	}
	return null;
}

const EXPERT_COMPANY_REASON =
	'Perseroan perorangan yang didirikan oleh orang pribadi berkeahlian khusus dan menyerahkan jasa sejenis jasa pekerjaan bebas tidak termasuk wajib pajak tarif final (Pasal 57 ayat (2) huruf b PP 20/2026).';
const FOUNDER_GROUP_REASON =
	'Omzet gabungan orang pribadi pendiri (beserta pasangan) dan seluruh perseroan perorangan yang didirikannya pernah melebihi Rp4,8 miliar dalam satu tahun pajak, sehingga tarif final tidak dapat dipakai pada tahun-tahun pajak berikutnya (Pasal 57 ayat (2) huruf e dan ayat (4), Pasal 58 ayat (3) PP 20/2026).';
const GRACE_2026_REASON =
	'Karena sebelumnya memakai tarif final menurut PP 55/2022, tarif final tetap dapat dipakai sampai akhir Tahun Pajak 2026 (Pasal II angka 1 huruf f PP 20/2026), lalu tidak berlaku mulai 2027.';

/** Individuals and perseroan perorangan from tax year 2026: no time limit (Pasal 59 dihapus). */
function individualOrCompanyOutcome(profile: TaxProfileData, taxYear: number): Outcome {
	const isCompany = profile.legalForm === TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY;
	const expert = isCompany && profile.soleOwnerProvidesProfessionalServices;
	const groupExceeded = profile.groupTurnoverExceeded;

	// Before 22 April 2026 tax year 2026 was still governed by PP 55/2022 with its time limits,
	// so a taxpayer already registered then needs a PP 55 basis to cover the whole year.
	if (taxYear === PP20_FIRST_TAX_YEAR && registeredBeforePp20(profile)) {
		const basis = pp55BasisFor2026(profile);
		if (basis && (expert || groupExceeded === true)) {
			return eligible(`${basis} ${GRACE_2026_REASON}`, {
				rule: PP20_RULE,
				lastYear: PP20_FIRST_TAX_YEAR
			});
		}
		if (basis) return eligible(basis);
		if (expert) return ineligible(EXPERT_COMPANY_REASON);
		if (groupExceeded === true) return ineligible(FOUNDER_GROUP_REASON);
		return needsInformation(
			`Jangka waktu PP 55/2022 berakhir pada Tahun Pajak ${pp55TermEnd(profile)} dan PP 20/2026 tidak memuat ketentuan peralihan Tahun Pajak 2026 untuk kondisi ini. Aturan baru tanpa batas waktu baru berlaku sejak 22 April 2026, sehingga perlakuan Januari–21 April 2026 perlu dikonfirmasi ke DJP atau konsultan pajak.`
		);
	}

	if (expert) return ineligible(EXPERT_COMPANY_REASON);
	if (groupExceeded === null) {
		return needsInformation(
			'Jawab apakah omzet gabungan Anda (beserta pasangan) dan seluruh perseroan perorangan yang didirikan pernah melebihi Rp4,8 miliar dalam satu tahun pajak (Pasal 57 ayat (2) huruf e PP 20/2026).'
		);
	}
	if (groupExceeded) return ineligible(FOUNDER_GROUP_REASON);
	return eligible(
		`Memenuhi Pasal 57 ayat (1) huruf ${isCompany ? 'b' : 'a'} PP 55/2022 sebagaimana diubah PP 20/2026; batas jangka waktu Pasal 59 telah dihapus.`
	);
}

/** Koperasi from tax year 2026. */
function cooperativeOutcome(profile: TaxProfileData, taxYear: number): Outcome {
	const termEnd = pp55TermEnd(profile)!;
	if (registeredBeforePp20(profile)) {
		// Pasal II angka 1 huruf b: a koperasi registered before 22 April 2026 whose PP 55
		// term ends in 2024–2029 keeps the final rate for tax years 2025–2029.
		if (termEnd < 2024) {
			return ineligible(
				`Jangka waktu tarif final koperasi menurut ${PP55_TERM_LABEL} berakhir pada Tahun Pajak ${termEnd}. Pasal II angka 1 huruf b PP 20/2026 hanya berlaku bila jangka waktu itu berakhir pada 2024–2029, dan Pasal 57 ayat (2) huruf f membatasi koperasi 4 tahun pajak sejak terdaftar.`
			);
		}
		if (termEnd > 2029) {
			return needsInformation(
				`Tahun awal jangka waktu PP 55/2022 (${profile.finalRegimeStartYear}) tidak sesuai untuk koperasi yang terdaftar sebelum 22 April 2026. Periksa kembali tahun tersebut.`
			);
		}
		if (taxYear <= 2029) {
			return eligible(
				`Koperasi terdaftar sebelum 22 April 2026 dengan jangka waktu PP 55/2022 yang berakhir pada Tahun Pajak ${termEnd}: tarif final berlaku untuk Tahun Pajak 2025 sampai dengan 2029 (Pasal II angka 1 huruf b PP 20/2026).`,
				{ rule: PP20_RULE, lastYear: 2029 }
			);
		}
		return ineligible(
			'Ketentuan peralihan koperasi hanya berlaku sampai Tahun Pajak 2029 (Pasal II angka 1 huruf b PP 20/2026), dan batas 4 tahun pajak sejak terdaftar telah lewat (Pasal 57 ayat (2) huruf f).'
		);
	}

	// Pasal 57 ayat (2) huruf f: 4 tax years counted from the tax year the koperasi registered.
	const firstYear = registrationYear(profile);
	const lastYear = firstYear + 3;
	if (taxYear <= lastYear) {
		return eligible(
			`Koperasi dapat memakai tarif final selama 4 tahun pajak sejak terdaftar, yaitu ${firstYear}–${lastYear} (Pasal 57 ayat (2) huruf f PP 20/2026).`,
			{ lastYear }
		);
	}
	return ineligible(
		`Koperasi telah melewati 4 tahun pajak sejak terdaftar pada ${firstYear}, sehingga tarif final tidak dapat dipakai lagi (Pasal 57 ayat (2) huruf f dan ayat (4) PP 20/2026).`
	);
}

/** CV, firma, PT and BUM Desa from tax year 2026 (Pasal II angka 1 huruf e PP 20/2026). */
function transitionalBodyOutcome(profile: TaxProfileData, taxYear: number): Outcome {
	if (!registeredBeforePp20(profile)) {
		return ineligible(
			'Sejak 22 April 2026, CV, firma, PT selain perseroan perorangan, dan BUM Desa tidak termasuk wajib pajak tarif final (Pasal 57 ayat (1) PP 20/2026). Ketentuan peralihan Pasal II angka 1 huruf e hanya bagi yang jangka waktu PP 55/2022-nya belum berakhir.'
		);
	}
	const outcome = pp55Outcome(profile, taxYear);
	if (outcome.status !== 'eligible') return outcome;
	const termEnd = pp55TermEnd(profile)!;
	return eligible(
		`Tarif final tetap dapat dipakai sampai ${pp55TermText(profile, termEnd)} berakhir (Pasal II angka 1 huruf e PP 20/2026).`,
		{ lastYear: termEnd }
	);
}

function pp20Outcome(profile: TaxProfileData, taxYear: number): Outcome {
	if (FOUNDER_GROUP_FORMS.has(profile.legalForm)) {
		return individualOrCompanyOutcome(profile, taxYear);
	}
	if (profile.legalForm === TAX_LEGAL_FORM.COOPERATIVE) {
		return cooperativeOutcome(profile, taxYear);
	}
	if (TRANSITIONAL_BODY_FORMS.has(profile.legalForm)) {
		return transitionalBodyOutcome(profile, taxYear);
	}
	return ineligible('Bentuk wajib pajak ini tidak termasuk Pasal 57 ayat (1) PP 20/2026.');
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
 * Determines whether Buku UMKM may show a PPh Final 0.5% estimate for a tax year, applying
 * PP 55/2022 as amended by PP 20/2026 (LN 2026 No. 43, in force 22 April 2026).
 * It deliberately fails closed: incomplete profiles, and cases the profile cannot decide,
 * return `needs_information` with an explanation and never a liability amount.
 */
export function evaluateTaxEligibility(
	profile: TaxProfileData | null,
	taxYear: number,
	currentYearAggregatedRevenue: number
): TaxEligibilityDecision {
	const decision = baseDecision(profile, taxYear, currentYearAggregatedRevenue);
	const stop = (status: TaxEligibilityDecision['status'], reason: string) => {
		decision.status = status;
		decision.reasons.push(reason);
		if (status === 'ineligible') decision.eligibleNextYear = false;
		return decision;
	};

	if (!profile) {
		return stop(
			'needs_information',
			`Lengkapi profil pajak untuk tahun ${taxYear} sebelum membuat estimasi.`
		);
	}

	if (taxYear < 2022) {
		return stop(
			'needs_information',
			'Estimasi otomatis sebelum tahun pajak 2022 tidak didukung; tinjau aturan historis secara manual.'
		);
	}

	if (profile.taxYear !== taxYear) {
		return stop('needs_information', 'Profil pajak tidak sesuai dengan tahun yang dihitung.');
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.registeredAt)) {
		return stop('needs_information', 'Tanggal pendaftaran wajib pajak belum valid.');
	}

	if (!profile.revenueDataComplete || !profile.aggregationConfirmed) {
		return stop(
			'needs_information',
			'Konfirmasikan bahwa omzet usaha, pasangan, dan perseroan perseorangan terkait sudah digabungkan.'
		);
	}

	if (profile.externalMonthlyRevenue.length !== 12) {
		return stop('needs_information', 'Omzet di luar Buku UMKM harus diisi untuk setiap bulan.');
	}

	if (
		profile.externalMonthlyRevenue.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
	) {
		return stop(
			'needs_information',
			'Omzet bulanan di luar Buku UMKM harus berupa Rupiah utuh dan tidak negatif.'
		);
	}

	// Pasal 57 ayat (2) huruf a, ayat (3) and ayat (4): choosing the Pasal 17 rates (notified to
	// DJP) is permanent. Being moved to them after turnover passed Rp4.8 billion is treated the
	// same way, which also covers Pasal 57 ayat (2) huruf e for the taxpayer's own turnover.
	if (profile.regimeChoice === TAX_REGIME_CHOICE.GENERAL || profile.everUsedGeneralRegime) {
		return stop(
			'ineligible',
			'Tarif umum Pasal 17 UU PPh telah dipilih atau wajib dipakai, sehingga tarif final UMKM tidak dapat dipakai lagi (Pasal 57 ayat (2) huruf a, ayat (3), dan ayat (4) PP 55/2022 sebagaimana diubah PP 20/2026).'
		);
	}

	if (profile.legalForm === TAX_LEGAL_FORM.PERMANENT_ESTABLISHMENT) {
		return stop(
			'ineligible',
			'Bentuk usaha tetap tidak termasuk wajib pajak tarif final UMKM (Pasal 57 ayat (2) huruf d).'
		);
	}

	if (profile.legalForm === TAX_LEGAL_FORM.OTHER) {
		return stop(
			'ineligible',
			'Bentuk wajib pajak ini tidak termasuk wajib pajak tarif final UMKM (Pasal 57 ayat (1)).'
		);
	}

	// Pasal 57 ayat (1) with Pasal 58 ayat (1)-(2): the previous tax year's gross turnover from
	// business and pekerjaan bebas, final and non-final, domestic and foreign, spouses combined.
	if (profile.priorYearAggregatedRevenue > FINAL_REGIME_ANNUAL_LIMIT) {
		return stop(
			'ineligible',
			`Omzet bruto Tahun Pajak ${taxYear - 1} melebihi Rp4,8 miliar (Pasal 57 ayat (1) dan Pasal 58 ayat (1)).`
		);
	}

	// Pasal 57 ayat (2) huruf c: Pasal 31A UU PPh, PP 94/2010 or KEK facilities. A body only.
	if (isBodyLegalForm(profile.legalForm) && profile.usesOtherTaxFacility) {
		return stop(
			'ineligible',
			'Badan yang memperoleh fasilitas Pasal 31A UU PPh, PP 94/2010, atau fasilitas Kawasan Ekonomi Khusus tidak termasuk wajib pajak tarif final (Pasal 57 ayat (2) huruf c).'
		);
	}

	// Pasal 56 ayat (3) huruf a and ayat (4): an individual's income from jasa sehubungan dengan
	// pekerjaan bebas is never under the final rate. Recorded revenue cannot be split into it
	// and business income, so fail closed rather than estimate on a mixed total.
	if (profile.legalForm === TAX_LEGAL_FORM.INDIVIDUAL && profile.hasProfessionalServiceIncome) {
		return stop(
			'needs_information',
			'Penghasilan orang pribadi dari jasa sehubungan dengan pekerjaan bebas tidak dikenai PPh Final 0,5% (Pasal 56 ayat (3) huruf a dan ayat (4) PP 20/2026). Buku UMKM belum dapat memisahkannya dari omzet usaha, jadi estimasi tidak ditampilkan; bila seluruh penghasilan Anda dari pekerjaan bebas, tarif final tidak berlaku sama sekali.'
		);
	}

	const outcome =
		taxYear < PP20_FIRST_TAX_YEAR ? pp55Outcome(profile, taxYear) : pp20Outcome(profile, taxYear);
	if (outcome.status !== 'eligible') return stop(outcome.status, outcome.reason);

	decision.status = 'eligible';
	if (outcome.rule) decision.rule = outcome.rule;
	decision.reasons.push(`Estimasi menggunakan ${decision.rule.name}.`, outcome.basis);
	if (outcome.lastYear === taxYear) decision.eligibleNextYear = false;
	if (decision.currentYearTurnoverExceeded) {
		decision.reasons.push(
			'Omzet tahun berjalan telah melewati Rp4,8 miliar; tarif final tetap berlaku sampai akhir tahun ini dan tidak berlaku tahun berikutnya.'
		);
	}
	if (decision.individualTurnoverFacility) {
		decision.reasons.push(
			`Bagian omzet usaha kumulatif sampai Rp${REVENUE_THRESHOLD_WP_OP.toLocaleString('id-ID')} tidak dikenai PPh Final (Pasal 60 ayat (2) PP 55/2022, tidak diubah PP 20/2026).`
		);
	}

	return decision;
}
