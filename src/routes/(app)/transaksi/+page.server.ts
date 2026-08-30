import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { error as httpError, redirect } from '@sveltejs/kit';
import { getTransactionPage } from '$lib/server/transactions/list';
import { getTransactionHref, parseTransactionQuery } from '$lib/transactions/query';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const query = parseTransactionQuery(url.searchParams);

	let result: Awaited<ReturnType<typeof getTransactionPage>>;
	try {
		result = await getTransactionPage(getDb(), locals.user.id, query);
	} catch (cause) {
		console.error('Error loading transactions:', cause);
		throw httpError(500, 'Transaksi tidak dapat dimuat. Data Anda tidak diubah.');
	}

	if (result.query.page !== query.page) {
		throw redirect(302, getTransactionHref(result.query));
	}
	return result;
};
