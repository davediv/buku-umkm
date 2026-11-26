import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentDebt } from '$lib/server/finance/presenters';

// DELETE /api/debts/[id]/payments/[paymentId] - Reverse a payment recorded by mistake
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id || !params.paymentId) {
		return json({ error: 'ID hutang/piutang dan pembayaran diperlukan' }, { status: 400 });
	}

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const updated = await service.reverseDebtPayment(locals.user.id, params.id, params.paymentId);
		return json({
			message: 'Pembayaran dibatalkan. Saldo kas dan sisa tagihan sudah dikembalikan.',
			debt: presentDebt(updated)
		});
	} catch (error) {
		return financeErrorResponse(error, 'reverse debt payment');
	}
};
