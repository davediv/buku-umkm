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
		if (!summaryRes.ok || !historyRes.ok) {
			throw new Error('Tax API returned an unsuccessful response');
		}

		const summaryJson = await summaryRes.json();
		const historyJson = await historyRes.json();

		const summaryData = summaryJson as TaxApiResponse<unknown>;
		const historyData = historyJson as TaxApiResponse<unknown>;

		return {
			summary: summaryData.data || null,
			history: historyData.data || null,
			error: null
		};
	} catch (cause) {
		console.error('Error loading tax data', cause);
		return {
			summary: null,
			history: null,
			error: 'Data pajak tidak dapat dimuat. Data Anda tidak diubah.'
		};
	}
};
