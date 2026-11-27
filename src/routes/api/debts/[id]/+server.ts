import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { debtQueries } from '#lib/server/db/queries/index.ts';
import { parseUpdateDebt } from '#lib/server/finance/contracts.ts';
import { createFinancialMutationService } from '#lib/server/finance/commands.ts';
import { createD1FinanceRepository } from '#lib/server/finance/repository.ts';
import { financeErrorResponse } from '#lib/server/finance/http.ts';
import { presentDebt } from '#lib/server/finance/presenters.ts';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return Response.json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const item = await debtQueries.findById(getDb(), locals.user.id, params.id);
		if (!item) return Response.json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		return Response.json({ debt: presentDebt(item) });
	} catch (error) {
		return financeErrorResponse(error, 'get debt');
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return Response.json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const updated = await service.updateDebt(
			locals.user.id,
			params.id,
			parseUpdateDebt(await request.json())
		);
		return Response.json({
			message: 'Hutang/piutang berhasil diperbarui',
			debt: presentDebt(updated)
		});
	} catch (error) {
		return financeErrorResponse(error, 'update debt');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return Response.json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		await service.deleteDebt(locals.user.id, params.id);
		return Response.json({ message: 'Hutang/piutang berhasil dihapus' });
	} catch (error) {
		return financeErrorResponse(error, 'delete debt');
	}
};
