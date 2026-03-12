import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { transactionQueries, categoryQueries, chartOfAccountQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const transactionId = params.id;
	const db = getDb();

	try {
		// Get transaction by ID
		const transaction = await transactionQueries.findById(db, userId, transactionId, true);

		if (!transaction) {
			return { error: 'Transaksi tidak ditemukan' };
		}

		// Get all categories and accounts for editing
		const allCategories = await categoryQueries.findAll(db, userId);
		const allAccounts = await chartOfAccountQueries.findAll(db, userId);

		const categories = {
			income: allCategories.filter((c) => c.type === 'income' && c.isActive),
			expense: allCategories.filter((c) => c.type === 'expense' && c.isActive)
		};

		const accounts = allAccounts.filter((a) => a.isActive);

		return {
			transaction,
			categories,
			accounts
		};
	} catch (error) {
		console.error('Error loading transaction:', error);
		return { error: 'Gagal memuat data transaksi' };
	}
};
