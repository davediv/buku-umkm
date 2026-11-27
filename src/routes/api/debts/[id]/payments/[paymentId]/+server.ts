import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { createFinancialMutationService } from '#lib/server/finance/commands.ts';
import { createD1FinanceRepository } from '#lib/server/finance/repository.ts';
import { financeErrorResponse } from '#lib/server/finance/http.ts';
import { presentDebt } from '#lib/server/finance/presenters.ts';

// DELETE /api/debts/[id]/payments/[paymentId] - Reverse a payment recorded by mistake
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id || !params.paymentId) {
		return Response.json({ error: 'ID hutang/piutang dan pembayaran diperlukan' }, { status: 400 });
	}

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const updated = await service.reverseDebtPayment(locals.user.id, params.id, params.paymentId);
		return Response.json({
			message: 'Pembayaran dibatalkan. Saldo kas dan sisa tagihan sudah dikembalikan.',
			debt: presentDebt(updated)
		});
	} catch (error) {
		return financeErrorResponse(error, 'reverse debt payment');
	}
};
