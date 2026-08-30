import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { parseCreateTransfer, requireIdempotencyKey } from '$lib/server/finance/contracts';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentTransfer } from '$lib/server/finance/presenters';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const result = await service.createTransfer(
			locals.user.id,
			requireIdempotencyKey(request),
			parseCreateTransfer(await request.json())
		);
		return json(
			{
				message: result.replayed
					? 'Transfer sudah tersimpan sebelumnya'
					: 'Transfer berhasil dibuat',
				transfer: presentTransfer(result.entity),
				replayed: result.replayed
			},
			{ status: result.replayed ? 200 : 201 }
		);
	} catch (error) {
		return financeErrorResponse(error, 'create transfer');
	}
};
