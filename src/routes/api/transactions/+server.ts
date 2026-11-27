import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { parseCreateTransaction, requireIdempotencyKey } from '#lib/server/finance/contracts.ts';
import { createFinancialMutationService } from '#lib/server/finance/commands.ts';
import { createD1FinanceRepository } from '#lib/server/finance/repository.ts';
import { financeErrorResponse } from '#lib/server/finance/http.ts';
import { presentTransaction } from '#lib/server/finance/presenters.ts';
import { getTransactionPage } from '#lib/server/transactions/list.ts';
import { parseTransactionQuery } from '#lib/transactions/query.ts';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		return Response.json(
			await getTransactionPage(getDb(), locals.user.id, parseTransactionQuery(url.searchParams))
		);
	} catch (error) {
		return financeErrorResponse(error, 'list transactions');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const input = parseCreateTransaction(await request.json());
		const commandKey = requireIdempotencyKey(request);
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const result = await service.createTransaction(locals.user.id, commandKey, input);

		return Response.json(
			{
				message: result.replayed
					? 'Transaksi sudah tersimpan sebelumnya'
					: 'Transaksi berhasil dibuat',
				transaction: presentTransaction(result.entity),
				replayed: result.replayed
			},
			{ status: result.replayed ? 200 : 201 }
		);
	} catch (error) {
		return financeErrorResponse(error, 'create transaction');
	}
};
