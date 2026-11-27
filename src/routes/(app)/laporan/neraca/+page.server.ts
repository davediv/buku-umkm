import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { getBalanceSheetAsOf } from '#lib/server/reports/balance-sheet.ts';
import { isIsoCalendarDate, todayInJakarta } from '#lib/shared/dates.ts';
import { summarizeError } from '#lib/server/error-summary.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) throw redirect(302, '/masuk');

	const today = todayInJakarta();
	const selectedDate = url.searchParams.get('date') || today;
	if (!isIsoCalendarDate(selectedDate) || selectedDate > today) {
		throw error(400, 'Tanggal laporan tidak valid');
	}

	try {
		return {
			balanceSheet: await getBalanceSheetAsOf(getDb(), locals.user.id, selectedDate)
		};
	} catch (cause) {
		console.error('Error fetching balance sheet data:', summarizeError(cause));
		return {
			balanceSheet: null,
			error: 'Gagal memuat data laporan posisi keuangan'
		};
	}
};
