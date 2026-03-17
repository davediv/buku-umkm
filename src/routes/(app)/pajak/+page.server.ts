import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface TaxApiResponse<T> {
	data?: T;
	error?: string;
}

/**
 * Load tax data for the tax overview page
 */
export const load: PageServerLoad = async ({ locals, fetch }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	try {
		// Fetch tax summary and history in parallel for better performance
		const currentYear = new Date().getFullYear();
		const [summaryRes, historyRes] = await Promise.all([
			fetch('/api/tax/summary'),
			fetch(`/api/tax/history?year=${currentYear}`)
		]);

		const summaryJson = await summaryRes.json();
		const historyJson = await historyRes.json();

		const summaryData = summaryJson as TaxApiResponse<unknown>;
		const historyData = historyJson as TaxApiResponse<unknown>;

		return {
			summary: summaryData.data || null,
			history: historyData.data || null,
			error: null
		};
	} catch {
		console.error('Error loading tax data');
		return {
			summary: null,
			history: null,
			error: 'Failed to load tax data'
		};
	}
};
