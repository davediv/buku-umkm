import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transactionQueries } from '$lib/server/db/queries';
import { parseCreateTransaction, requireIdempotencyKey } from '$lib/server/finance/contracts';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentTransaction } from '$lib/server/finance/presenters';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);
		const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
		const requestedType = url.searchParams.get('type');
		const type =
			requestedType === 'income' || requestedType === 'expense' || requestedType === 'transfer'
				? requestedType
				: undefined;
		const transactions = await transactionQueries.findAll(getDb(), locals.user.id, {
			limit,
			offset,
			accountId: url.searchParams.get('account_id') || undefined,
			categoryId: url.searchParams.get('category_id') || undefined,
			type,
			startDate: url.searchParams.get('start_date') || undefined,
			endDate: url.searchParams.get('end_date') || undefined
		});

		return json({ transactions: transactions.map(presentTransaction) });
	} catch (error) {
		return financeErrorResponse(error, 'list transactions');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const input = parseCreateTransaction(await request.json());
		const commandKey = requireIdempotencyKey(request);
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const result = await service.createTransaction(locals.user.id, commandKey, input);

		return json(
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
