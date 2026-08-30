import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries } from '$lib/server/db/queries';
import { parseDebtPayment, requireIdempotencyKey } from '$lib/server/finance/contracts';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentDebt, presentPayment, presentTransaction } from '$lib/server/finance/presenters';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const item = await debtQueries.findById(getDb(), locals.user.id, params.id);
		if (!item) return json({ error: 'Hutang/piutang tidak ditemukan' }, { status: 404 });
		const presented = presentDebt(item);
		return json({ debt: presented, payments: presented.payments });
	} catch (error) {
		return financeErrorResponse(error, 'list debt payments');
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID hutang/piutang diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const result = await service.recordDebtPayment(
			locals.user.id,
			params.id,
			requireIdempotencyKey(request),
			parseDebtPayment(await request.json())
		);
		return json(
			{
				message: result.replayed
					? 'Pembayaran sudah tersimpan sebelumnya'
					: result.entity.debt.remainingAmount === 0
						? 'Pembayaran berhasil - hutang/piutang lunas'
						: 'Pembayaran berhasil dicatat',
				payment: presentPayment(result.entity.payment),
				debt: presentDebt(result.entity.debt),
				transaction: presentTransaction(result.entity.transaction),
				replayed: result.replayed
			},
			{ status: result.replayed ? 200 : 201 }
		);
	} catch (error) {
		return financeErrorResponse(error, 'record debt payment');
	}
};
