import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { getTaxProfile } from '#lib/tax/service.ts';
import { jakartaToday } from '#lib/tax/period.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) throw redirect(302, '/masuk');
	const currentYear = jakartaToday().year;
	const requestedYear = Number(url.searchParams.get('year') ?? currentYear);
	const taxYear =
		Number.isInteger(requestedYear) && requestedYear >= 2018 && requestedYear <= 2100
			? requestedYear
			: currentYear;

	return {
		taxYear,
		profile: await getTaxProfile(getDb(), locals.user.id, taxYear)
	};
};
