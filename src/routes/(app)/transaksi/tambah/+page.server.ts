import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	categoryQueries,
	chartOfAccountQueries,
	transactionTemplateQueries
} from '$lib/server/db/queries';
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

		// Get all active templates
		const templates = await transactionTemplateQueries.findAllActive(db, userId);

		// Map to include category info for display
		const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
		const mappedTemplates = templates.map((tmpl) => ({
			id: tmpl.id,
			name: tmpl.name,
			type: tmpl.type,
			categoryId: tmpl.categoryId,
			categoryName: tmpl.categoryId ? categoryMap.get(tmpl.categoryId)?.name : null,
			description: tmpl.description,
			isSystem: tmpl.isSystem
		}));

		return {
			categories,
			accounts,
			templates: mappedTemplates
		};
	} catch (error) {
		console.error('Error loading transaction form data:', error);
		return {
			categories: { income: [], expense: [] },
			accounts: [],
			templates: [],
			error: 'Gagal memuat data'
		};
	}
};
