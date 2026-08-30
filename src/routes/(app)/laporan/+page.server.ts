import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLegacyReportRedirect } from '$lib/reports/navigation';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) throw redirect(302, '/masuk');

	const legacyDestination = getLegacyReportRedirect(url.searchParams);
	if (legacyDestination) throw redirect(301, legacyDestination);

	return {};
};
