import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries } from '$lib/server/db/queries';
import { parseUpdateDebt } from '$lib/server/finance/contracts';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentDebt } from '$lib/server/finance/presenters';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const item = await debtQueries.findById(getDb(), locals.user.id, params.id);
		if (!item) return json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		return json({ debt: presentDebt(item) });
	} catch (error) {
		return financeErrorResponse(error, 'get debt');
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const updated = await service.updateDebt(
			locals.user.id,
			params.id,
			parseUpdateDebt(await request.json())
		);
		return json({
			message: 'Hutang/piutang berhasil diperbarui',
			debt: presentDebt(updated)
		});
	} catch (error) {
		return financeErrorResponse(error, 'update debt');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		await service.deleteDebt(locals.user.id, params.id);
		return json({ message: 'Hutang/piutang berhasil dihapus' });
	} catch (error) {
		return financeErrorResponse(error, 'delete debt');
	}
};
