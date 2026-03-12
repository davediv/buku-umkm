import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { transactionQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Parse query params
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const type = url.searchParams.get('type') as 'income' | 'expense' | undefined;
		const startDate = url.searchParams.get('start_date') || undefined;
		const endDate = url.searchParams.get('end_date') || undefined;

		const transactions = await transactionQueries.findAll(db, userId, {
			limit,
			offset,
			type,
			startDate,
			endDate
		});

		return {
			transactions,
			filters: { type, startDate, endDate }
		};
	} catch (error) {
		console.error('Error loading transactions:', error);
		return {
			transactions: [],
			error: 'Gagal memuat transaksi'
		};
	}
};
