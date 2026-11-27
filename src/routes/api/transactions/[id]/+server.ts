import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { transactionQueries } from '#lib/server/db/queries/index.ts';
import { parseUpdateTransaction } from '#lib/server/finance/contracts.ts';
import { createFinancialMutationService } from '#lib/server/finance/commands.ts';
import { createD1FinanceRepository } from '#lib/server/finance/repository.ts';
import { financeErrorResponse } from '#lib/server/finance/http.ts';
import { presentTransaction } from '#lib/server/finance/presenters.ts';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return Response.json({ error: 'ID transaksi diperlukan' }, { status: 400 });

	try {
		const item = await transactionQueries.findById(getDb(), locals.user.id, params.id);
		if (!item) return Response.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		return Response.json({ transaction: presentTransaction(item) });
	} catch (error) {
		return financeErrorResponse(error, 'get transaction');
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return Response.json({ error: 'ID transaksi diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const updated = await service.updateTransaction(
			locals.user.id,
			params.id,
			parseUpdateTransaction(await request.json())
		);
		return Response.json({
			message: 'Transaksi berhasil diperbarui',
			transaction: presentTransaction(updated)
		});
	} catch (error) {
		return financeErrorResponse(error, 'update transaction');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return Response.json({ error: 'ID transaksi diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		await service.deleteTransaction(locals.user.id, params.id);
		return Response.json({ message: 'Transaksi berhasil dihapus' });
	} catch (error) {
		return financeErrorResponse(error, 'delete transaction');
	}
};
