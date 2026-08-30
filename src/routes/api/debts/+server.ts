import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries } from '$lib/server/db/queries';
import { parseCreateDebt, requireIdempotencyKey } from '$lib/server/finance/contracts';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { financeErrorResponse } from '$lib/server/finance/http';
import { presentDebt } from '$lib/server/finance/presenters';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const requestedType = url.searchParams.get('type');
		const requestedStatus = url.searchParams.get('status');
		const type =
			requestedType === 'piutang' || requestedType === 'hutang' ? requestedType : undefined;
		const status =
			requestedStatus === 'active' || requestedStatus === 'paid' || requestedStatus === 'overdue'
				? requestedStatus
				: undefined;
		const debts = await debtQueries.findAll(getDb(), locals.user.id, {
			type,
			status,
			includeInactive: url.searchParams.get('include_inactive') === 'true'
		});
		return json({ debts: debts.map(presentDebt) });
	} catch (error) {
		return financeErrorResponse(error, 'list debts');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const service = createFinancialMutationService(createD1FinanceRepository(getDb()));
		const input = parseCreateDebt(await request.json());
		const result = await service.createDebt(locals.user.id, requireIdempotencyKey(request), input);
		return json(
			{
				message: result.replayed
					? 'Hutang/piutang sudah tersimpan sebelumnya'
					: input.type === 'piutang'
						? 'Piutang berhasil dibuat'
						: 'Hutang berhasil dibuat',
				debt: presentDebt(result.entity),
				replayed: result.replayed
			},
			{ status: result.replayed ? 200 : 201 }
		);
	} catch (error) {
		return financeErrorResponse(error, 'create debt');
	}
};
