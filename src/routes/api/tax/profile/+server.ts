import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { TAX_LEGAL_FORM, TAX_REGIME_CHOICE } from '#lib/tax/config.ts';
import { getTaxProfile, upsertTaxProfile } from '#lib/tax/service.ts';
import type { TaxProfileData } from '#lib/tax/types.ts';
import { isIsoCalendarDate } from '#lib/shared/dates.ts';
import { jakartaToday } from '#lib/tax/period.ts';
import { isWholeRupiah, MAX_RUPIAH_INPUT } from '#lib/tax/payments.ts';

const LEGAL_FORMS = new Set<string>(Object.values(TAX_LEGAL_FORM));
const REGIME_CHOICES = new Set<string>(Object.values(TAX_REGIME_CHOICE));

function parseYear(value: string | null): number | null {
	if (!value || !/^\d{4}$/.test(value)) return null;
	const year = Number(value);
	return year >= 2018 && year <= 2100 ? year : null;
}

/** A JSON number that is a whole year in range. Strings such as "2026" are rejected. */
const isYear = (value: unknown, min: number, max: number): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const MAX_RUPIAH_LABEL = `Rp${MAX_RUPIAH_INPUT.toLocaleString('id-ID')}`;

/**
 * Validates a tax profile body. Amounts must be JSON numbers in whole Rupiah from 0 to
 * MAX_RUPIAH_INPUT: Number() would read "750.000" as 750 and "" as 0.
 */
function parseProfile(value: unknown): { data?: TaxProfileData; error?: string } {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return { error: 'Data profil pajak tidak valid.' };
	}
	const body = value as Record<string, unknown>;
	const {
		taxYear,
		legalForm,
		registeredAt,
		finalRegimeStartYear,
		regimeChoice,
		priorYearAggregatedRevenue,
		externalMonthlyRevenue
	} = body;

	if (!isYear(taxYear, 2018, 2100)) return { error: 'Tahun pajak tidak valid.' };
	if (typeof legalForm !== 'string' || !LEGAL_FORMS.has(legalForm)) {
		return { error: 'Bentuk wajib pajak tidak valid.' };
	}
	if (
		typeof registeredAt !== 'string' ||
		!isIsoCalendarDate(registeredAt) ||
		registeredAt > jakartaToday().date
	) {
		return { error: 'Tanggal pendaftaran wajib pajak tidak valid.' };
	}
	if (!isYear(finalRegimeStartYear, 2018, taxYear)) {
		return { error: 'Tahun awal penggunaan tarif final tidak valid.' };
	}
	if (typeof regimeChoice !== 'string' || !REGIME_CHOICES.has(regimeChoice)) {
		return { error: 'Pilihan rezim pajak tidak valid.' };
	}
	if (!isWholeRupiah(priorYearAggregatedRevenue)) {
		return {
			error: `Omzet agregat tahun sebelumnya harus berupa angka Rupiah utuh dari 0 sampai ${MAX_RUPIAH_LABEL}.`
		};
	}
	if (
		!Array.isArray(externalMonthlyRevenue) ||
		externalMonthlyRevenue.length !== 12 ||
		!externalMonthlyRevenue.every((amount) => isWholeRupiah(amount))
	) {
		return {
			error: `Isi omzet di luar Buku UMKM untuk seluruh 12 bulan sebagai angka Rupiah utuh dari 0 sampai ${MAX_RUPIAH_LABEL}.`
		};
	}

	const booleanFields = [
		'everUsedGeneralRegime',
		'revenueDataComplete',
		'aggregationConfirmed',
		'hasProfessionalServiceIncome',
		'soleOwnerProvidesProfessionalServices',
		'usesOtherTaxFacility'
	] as const;
	if (booleanFields.some((field) => typeof body[field] !== 'boolean')) {
		return { error: 'Konfirmasi profil pajak belum lengkap.' };
	}
	// Optional so a page cached before this question existed can still save; absent means no.
	const turnoverLimitExceeded = body.turnoverLimitExceeded ?? false;
	if (typeof turnoverLimitExceeded !== 'boolean') {
		return { error: 'Jawaban omzet melebihi Rp4,8 miliar tidak valid.' };
	}
	// Optional: null (or absent) leaves Pasal 57 ayat (2) huruf e unanswered, and eligibility
	// then fails closed where the answer matters.
	const groupTurnoverExceeded = body.groupTurnoverExceeded ?? null;
	if (groupTurnoverExceeded !== null && typeof groupTurnoverExceeded !== 'boolean') {
		return { error: 'Jawaban omzet gabungan perseroan perorangan tidak valid.' };
	}

	return {
		data: {
			taxYear,
			legalForm: legalForm as TaxProfileData['legalForm'],
			registeredAt,
			finalRegimeStartYear,
			regimeChoice: regimeChoice as TaxProfileData['regimeChoice'],
			everUsedGeneralRegime: body.everUsedGeneralRegime as boolean,
			turnoverLimitExceeded,
			priorYearAggregatedRevenue,
			externalMonthlyRevenue: externalMonthlyRevenue as number[],
			revenueDataComplete: body.revenueDataComplete as boolean,
			aggregationConfirmed: body.aggregationConfirmed as boolean,
			hasProfessionalServiceIncome: body.hasProfessionalServiceIncome as boolean,
			soleOwnerProvidesProfessionalServices: body.soleOwnerProvidesProfessionalServices as boolean,
			usesOtherTaxFacility: body.usesOtherTaxFacility as boolean,
			groupTurnoverExceeded
		}
	};
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || !locals.session)
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	const taxYear = parseYear(url.searchParams.get('year') ?? String(jakartaToday().year));
	if (!taxYear) return Response.json({ error: 'Tahun pajak tidak valid.' }, { status: 400 });

	const profile = await getTaxProfile(getDb(), locals.user.id, taxYear);
	return Response.json({ data: profile });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || !locals.session)
		return Response.json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'JSON tidak valid.' }, { status: 400 });
	}

	const parsed = parseProfile(body);
	if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });

	const saved = await upsertTaxProfile(getDb(), locals.user.id, parsed.data);
	return Response.json({ data: saved });
};
