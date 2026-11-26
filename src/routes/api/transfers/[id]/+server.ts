import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';

// DELETE /api/transfers/[id] - Reverse a transfer made by mistake (id: the transfer id
// both legs carry as their reference number)
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!params.id) return json({ error: 'ID transfer diperlukan' }, { status: 400 });

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		await service.reverseTransfer(locals.user.id, params.id);
		return json({ message: 'Transfer dibatalkan. Saldo kedua akun sudah dikembalikan.' });
	} catch (error) {
		return financeErrorResponse(error, 'reverse transfer');
	}
};
