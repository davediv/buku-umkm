import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { financeErrorResponse } from '$lib/server/finance/http';
import { getTransactionsForExport } from '$lib/server/transactions/list';
import { parseTransactionQuery } from '$lib/transactions/query';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const transactions = await getTransactionsForExport(
			getDb(),
			locals.user.id,
			parseTransactionQuery(url.searchParams)
		);
		return json({ transactions, total: transactions.length });
	} catch (error) {
		return financeErrorResponse(error, 'export transactions');
	}
};
