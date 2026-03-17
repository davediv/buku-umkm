import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { debtQueries } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Get type from query param
	const typeParam = url.searchParams.get('type');
	const type = typeParam === 'piutang' || typeParam === 'hutang' ? typeParam : null;

	// Fetch all debts (we'll filter client-side for search, but fetch all for now)
	const debts = await debtQueries.findAll(db, userId, {
		type: type ?? undefined,
		includeInactive: false
	});

	// Calculate summary
	const piutang = debts
		.filter((d) => d.type === 'piutang')
		.reduce((sum, d) => sum + d.remainingAmount, 0);
	const hutang = debts
		.filter((d) => d.type === 'hutang')
		.reduce((sum, d) => sum + d.remainingAmount, 0);

	return {
		debts: debts.map((d) => ({
			id: d.id,
			type: d.type,
			contactName: d.contactName,
			contactPhone: d.contactPhone,
			contactAddress: d.contactAddress,
			originalAmount: d.originalAmount,
			paidAmount: d.paidAmount,
			remainingAmount: d.remainingAmount,
			date: d.date,
			dueDate: d.dueDate,
			description: d.description,
			status: d.status
		})),
		summary: {
			piutang,
			hutang
		}
	};
};
