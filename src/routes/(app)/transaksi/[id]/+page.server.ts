import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	transactionQueries,
	categoryQueries,
	chartOfAccountQueries,
	transactionPhotoQueries
} from '$lib/server/db/queries';
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
		// Load independent form data together so valid edit routes need one database round trip window.
		const [transaction, allCategories, allAccounts, photos] = await Promise.all([
			transactionQueries.findById(db, userId, transactionId, true),
			categoryQueries.findAll(db, userId),
			chartOfAccountQueries.findAll(db, userId),
			transactionPhotoQueries.findByTransactionId(db, userId, transactionId)
		]);

		if (!transaction) {
			return { error: 'Transaksi tidak ditemukan' };
		}

		const categories = {
			income: allCategories.filter((c) => c.type === 'income' && c.isActive),
			expense: allCategories.filter((c) => c.type === 'expense' && c.isActive)
		};

		const accounts = allAccounts.filter((a) => a.isActive);

		return {
			transaction,
			categories,
			accounts,
			photos
		};
	} catch {
		console.error('Error loading transaction:');
		return { error: 'Gagal memuat data transaksi' };
	}
};
