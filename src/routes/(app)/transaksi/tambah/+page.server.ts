import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { categoryQueries, chartOfAccountQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Get all categories (active only)
		const allCategories = await categoryQueries.findAll(db, userId);
		const categories = {
			income: allCategories.filter((c) => c.type === 'income' && c.isActive),
			expense: allCategories.filter((c) => c.type === 'expense' && c.isActive)
		};

		// Get all active accounts (cash, bank, ewallet)
		const allAccounts = await chartOfAccountQueries.findAll(db, userId);
		const accounts = allAccounts.filter((a) => a.isActive);

		return {
			categories,
			accounts
		};
	} catch (error) {
		console.error('Error loading transaction form data:', error);
		return {
			categories: { income: [], expense: [] },
			accounts: [],
			error: 'Gagal memuat data'
		};
	}
};
