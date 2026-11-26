import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { chartOfAccountQueries, debtQueries } from '$lib/server/db/queries';
import { filterActiveAccounts } from '$lib/shared/account-types';
import { getDebtList } from '$lib/debts/list';
import { parseDebtQuery } from '$lib/debts/query';
import { todayInJakarta } from '$lib/shared/dates';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	const query = parseDebtQuery(url.searchParams);
	// Totals and urgency must come from the complete collection, never the selected tab subset.
	const [allDebts, allAccounts] = await Promise.all([
		debtQueries.findAllSummaries(db, userId, { includeInactive: false }),
		chartOfAccountQueries.findAll(db, userId)
	]);
	const normalizedDebts = allDebts.map((item) => ({
		id: item.id,
		type: item.type,
		kind: item.kind,
		contactName: item.contactName,
		contactPhone: item.contactPhone,
		contactAddress: item.contactAddress,
		originalAmount: item.originalAmount,
		paidAmount: item.paidAmount,
		remainingAmount: item.remainingAmount,
		date: item.date,
		dueDate: item.dueDate,
		description: item.description,
		status: item.status
	}));
	const today = todayInJakarta();
	const result = getDebtList(normalizedDebts, query, today);

	return {
		debts: result.items,
		summary: result.summary,
		// Where a loan's principal is paid out or received.
		accounts: filterActiveAccounts(allAccounts).map((account) => ({
			id: account.id,
			name: account.name,
			balance: account.balance
		})),
		query,
		today
	};
};
