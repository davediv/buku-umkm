import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import { categoryQueries, transactionTemplateQueries } from '$lib/server/db/queries';
import { error as httpError, redirect, fail } from '@sveltejs/kit';
import { summarizeError } from '$lib/server/error-summary';
import { resolveTemplateCategory } from '$lib/server/templates/category';
import {
	isCategoryType,
	validateTemplateDescription,
	validateTemplateName
} from '$lib/shared/validation/category';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Get all categories for the template form
		const allCategories = await categoryQueries.findAll(db, userId);
		const categories = {
			income: allCategories.filter((c) => c.type === 'income' && c.isActive),
			expense: allCategories.filter((c) => c.type === 'expense' && c.isActive)
		};

		// Get all templates
		const templates = await transactionTemplateQueries.findAll(db, userId);

		// Map to include category info
		const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
		const mappedTemplates = templates.map((tmpl) => ({
			id: tmpl.id,
			name: tmpl.name,
			type: tmpl.type,
			categoryId: tmpl.categoryId,
			categoryName: tmpl.categoryId ? categoryMap.get(tmpl.categoryId)?.name : null,
			description: tmpl.description,
			isSystem: tmpl.isSystem,
			isActive: tmpl.isActive
		}));

		return {
			categories,
			templates: mappedTemplates
		};
	} catch (cause) {
		console.error('Error fetching templates:', summarizeError(cause));
		throw httpError(500, 'Template transaksi tidak dapat dimuat. Data Anda tidak diubah.');
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized', success: false });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const name = validateTemplateName(formData.get('name'));
			const type = formData.get('type');
			const categoryId = formData.get('categoryId');
			const description = validateTemplateDescription(formData.get('description') ?? undefined);

			// Validate fields
			if (!name.ok) {
				return fail(400, { error: name.error, success: false });
			}

			if (!isCategoryType(type)) {
				return fail(400, { error: 'Tipe transaksi wajib dipilih', success: false });
			}

			if (!description.ok) {
				return fail(400, { error: description.error, success: false });
			}

			const categoryCheck = await resolveTemplateCategory(db, userId, categoryId, type);
			if (!categoryCheck.ok) {
				return fail(400, { error: categoryCheck.error, success: false });
			}

			// Create the template
			const createdTemplate = await transactionTemplateQueries.create(db, {
				userId,
				name: name.value,
				type,
				categoryId: categoryCheck.category?.id,
				description: description.value ?? undefined,
				isSystem: false
			});

			return {
				success: true,
				message: 'Template berhasil dibuat',
				template: {
					...createdTemplate,
					categoryName: categoryCheck.category?.name ?? null
				}
			};
		} catch {
			console.error('Error creating template:');
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	},

	update: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized', success: false });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const id = formData.get('id') as string;
			const name = validateTemplateName(formData.get('name'));
			const type = formData.get('type');
			// Absent fields stay unchanged; an empty category or description clears it.
			const categoryId = formData.get('categoryId') as string | null;
			const description = validateTemplateDescription(formData.get('description') ?? undefined);

			// Validate fields
			if (!id) {
				return fail(400, { error: 'ID template diperlukan', success: false });
			}

			if (!name.ok) {
				return fail(400, { error: name.error, success: false });
			}

			if (type !== null && !isCategoryType(type)) {
				return fail(400, { error: 'Tipe transaksi wajib dipilih', success: false });
			}

			if (!description.ok) {
				return fail(400, { error: description.error, success: false });
			}

			// Check if template exists
			const existingTemplate = await transactionTemplateQueries.findById(db, userId, id);
			if (!existingTemplate) {
				return fail(404, { error: 'Template tidak ditemukan', success: false });
			}

			// System templates cannot be modified
			if (existingTemplate.isSystem) {
				return fail(400, { error: 'Template sistem tidak dapat diubah', success: false });
			}

			// A new category, or a new type for the current one, must be the user's own
			// active category of the template's type.
			const nextType = type ?? (existingTemplate.type as 'income' | 'expense');
			const nextCategoryId = categoryId === null ? existingTemplate.categoryId : categoryId || null;
			if (nextType !== existingTemplate.type || nextCategoryId !== existingTemplate.categoryId) {
				const categoryCheck = await resolveTemplateCategory(db, userId, nextCategoryId, nextType);
				if (!categoryCheck.ok) {
					return fail(400, { error: categoryCheck.error, success: false });
				}
			}

			// Update the template
			await transactionTemplateQueries.update(db, userId, id, {
				name: name.value,
				type: nextType,
				categoryId: nextCategoryId,
				description: description.value
			});

			return {
				success: true,
				message: 'Template berhasil diperbarui'
			};
		} catch {
			console.error('Error updating template:');
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	},

	delete: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized', success: false });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const id = formData.get('id') as string;

			if (!id) {
				return fail(400, { error: 'ID template diperlukan', success: false });
			}

			// Check if template exists
			const existingTemplate = await transactionTemplateQueries.findById(db, userId, id);
			if (!existingTemplate) {
				return fail(404, { error: 'Template tidak ditemukan', success: false });
			}

			// System templates cannot be deleted
			if (existingTemplate.isSystem) {
				return fail(400, { error: 'Template sistem tidak dapat dihapus', success: false });
			}

			// Delete the template
			await transactionTemplateQueries.delete(db, userId, id);

			return {
				success: true,
				message: 'Template berhasil dihapus'
			};
		} catch {
			console.error('Error deleting template:');
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	},

	toggle: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized', success: false });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const id = formData.get('id') as string;
			const isActive = formData.get('isActive') === 'true';

			if (!id) {
				return fail(400, { error: 'ID template diperlukan', success: false });
			}

			// Toggle the template status
			await transactionTemplateQueries.update(db, userId, id, { isActive });

			return {
				success: true,
				message: isActive ? 'Template berhasil diaktifkan' : 'Template berhasil dinonaktifkan'
			};
		} catch {
			console.error('Error toggling template:');
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	}
};
