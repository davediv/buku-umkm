import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { financeErrorResponse } from '#lib/server/finance/http.ts';
import { getTransactionsForExport } from '#lib/server/transactions/list.ts';
import { parseTransactionQuery } from '#lib/transactions/query.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const transactions = await getTransactionsForExport(
			getDb(),
			locals.user.id,
			parseTransactionQuery(url.searchParams)
		);
		return Response.json({ transactions, total: transactions.length });
	} catch (error) {
		return financeErrorResponse(error, 'export transactions');
	}
};
