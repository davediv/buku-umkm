import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { redirect } from '@sveltejs/kit';
import { getTransactionPage } from '$lib/server/transactions/list';
import {
	getTransactionHref,
	getTransactionPagination,
	parseTransactionQuery
} from '$lib/transactions/query';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const query = parseTransactionQuery(url.searchParams);

	let result: Awaited<ReturnType<typeof getTransactionPage>>;
	try {
		result = await getTransactionPage(getDb(), locals.user.id, query);
	} catch (error) {
		console.error('Error loading transactions:', error);
		return {
			transactions: [],
			query,
			pagination: getTransactionPagination(0, query.page, query.pageSize),
			error: 'Gagal memuat transaksi'
		};
	}

	if (result.query.page !== query.page) {
		throw redirect(302, getTransactionHref(result.query));
	}
	return result;
};
