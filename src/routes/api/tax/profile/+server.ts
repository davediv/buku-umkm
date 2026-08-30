import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { TAX_LEGAL_FORM, TAX_REGIME_CHOICE } from '$lib/tax/config';
import { getTaxProfile, upsertTaxProfile } from '$lib/tax/service';
import type { TaxProfileData } from '$lib/tax/types';
import { isIsoCalendarDate } from '$lib/shared/dates';

const LEGAL_FORMS = new Set<string>(Object.values(TAX_LEGAL_FORM));
const REGIME_CHOICES = new Set<string>(Object.values(TAX_REGIME_CHOICE));

function parseYear(value: string | null): number | null {
	const year = Number(value);
	return Number.isInteger(year) && year >= 2018 && year <= 2100 ? year : null;
}

function parseProfile(value: unknown): { data?: TaxProfileData; error?: string } {
	if (!value || typeof value !== 'object') return { error: 'Data profil pajak tidak valid.' };
	const body = value as Record<string, unknown>;
	const taxYear = Number(body.taxYear);
	const finalRegimeStartYear = Number(body.finalRegimeStartYear);
	const priorYearAggregatedRevenue = Number(body.priorYearAggregatedRevenue);
	const externalMonthlyRevenue = body.externalMonthlyRevenue;

	if (!Number.isInteger(taxYear) || taxYear < 2018 || taxYear > 2100) {
		return { error: 'Tahun pajak tidak valid.' };
	}
	if (!LEGAL_FORMS.has(String(body.legalForm))) return { error: 'Bentuk wajib pajak tidak valid.' };
	if (!isIsoCalendarDate(String(body.registeredAt))) {
		return { error: 'Tanggal pendaftaran wajib pajak tidak valid.' };
	}
	if (
		!Number.isInteger(finalRegimeStartYear) ||
		finalRegimeStartYear < 2018 ||
		finalRegimeStartYear > taxYear
	) {
		return { error: 'Tahun awal penggunaan tarif final tidak valid.' };
	}
	if (!REGIME_CHOICES.has(String(body.regimeChoice))) {
		return { error: 'Pilihan rezim pajak tidak valid.' };
	}
	if (!Number.isSafeInteger(priorYearAggregatedRevenue) || priorYearAggregatedRevenue < 0) {
		return { error: 'Omzet agregat tahun sebelumnya harus berupa Rupiah utuh.' };
	}
	if (
		!Array.isArray(externalMonthlyRevenue) ||
		externalMonthlyRevenue.length !== 12 ||
		externalMonthlyRevenue.some(
			(amount) => !Number.isSafeInteger(Number(amount)) || Number(amount) < 0
		)
	) {
		return { error: 'Isi omzet di luar Buku UMKM untuk seluruh 12 bulan.' };
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

	return {
		data: {
			taxYear,
			legalForm: String(body.legalForm) as TaxProfileData['legalForm'],
			registeredAt: String(body.registeredAt),
			finalRegimeStartYear,
			regimeChoice: String(body.regimeChoice) as TaxProfileData['regimeChoice'],
			everUsedGeneralRegime: body.everUsedGeneralRegime as boolean,
			priorYearAggregatedRevenue,
			externalMonthlyRevenue: externalMonthlyRevenue.map(Number),
			revenueDataComplete: body.revenueDataComplete as boolean,
			aggregationConfirmed: body.aggregationConfirmed as boolean,
			hasProfessionalServiceIncome: body.hasProfessionalServiceIncome as boolean,
			soleOwnerProvidesProfessionalServices: body.soleOwnerProvidesProfessionalServices as boolean,
			usesOtherTaxFacility: body.usesOtherTaxFacility as boolean
		}
	};
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || !locals.session) return json({ error: 'Unauthorized' }, { status: 401 });
	const taxYear = parseYear(url.searchParams.get('year') ?? String(new Date().getFullYear()));
	if (!taxYear) return json({ error: 'Tahun pajak tidak valid.' }, { status: 400 });

	const profile = await getTaxProfile(getDb(), locals.user.id, taxYear);
	return json({ data: profile });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || !locals.session) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON tidak valid.' }, { status: 400 });
	}

	const parsed = parseProfile(body);
	if (!parsed.data) return json({ error: parsed.error }, { status: 400 });

	const saved = await upsertTaxProfile(getDb(), locals.user.id, parsed.data);
	return json({ data: saved });
};
