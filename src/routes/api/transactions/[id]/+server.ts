import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transactionQueries } from '$lib/server/db/queries';
import { parseUpdateTransaction } from '$lib/server/finance/contracts';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentTransaction } from '$lib/server/finance/presenters';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID transaksi diperlukan' }, { status: 400 });

	try {
		const item = await transactionQueries.findById(getDb(), locals.user.id, params.id);
		if (!item) return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		return json({ transaction: presentTransaction(item) });
	} catch (error) {
		return financeErrorResponse(error, 'get transaction');
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID transaksi diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const updated = await service.updateTransaction(
			locals.user.id,
			params.id,
			parseUpdateTransaction(await request.json())
		);
		return json({
			message: 'Transaksi berhasil diperbarui',
			transaction: presentTransaction(updated)
		});
	} catch (error) {
		return financeErrorResponse(error, 'update transaction');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID transaksi diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		await service.deleteTransaction(locals.user.id, params.id);
		return json({ message: 'Transaksi berhasil dihapus' });
	} catch (error) {
		return financeErrorResponse(error, 'delete transaction');
	}
};
