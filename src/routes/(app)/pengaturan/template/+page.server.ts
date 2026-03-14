import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import { categoryQueries, transactionTemplateQueries } from '$lib/server/db/queries';
import { redirect, fail } from '@sveltejs/kit';

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
	} catch (error) {
		console.error('Error fetching templates:', error);
		return {
			categories: { income: [], expense: [] },
			templates: [],
			error: 'Gagal memuat data template'
		};
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
			const name = formData.get('name') as string;
			const type = formData.get('type') as 'income' | 'expense';
			const categoryId = formData.get('categoryId') as string;
			const description = formData.get('description') as string;

			// Validate required fields
			if (!name || name.trim() === '') {
				return fail(400, { error: 'Nama template wajib diisi', success: false });
			}

			if (!type || (type !== 'income' && type !== 'expense')) {
				return fail(400, { error: 'Tipe transaksi wajib dipilih', success: false });
			}

			// Create the template
			await transactionTemplateQueries.create(db, {
				userId,
				name: name.trim(),
				type,
				categoryId: categoryId || undefined,
				description: description || undefined,
				isSystem: false
			});

			return {
				success: true,
				message: 'Template berhasil dibuat'
			};
		} catch (error) {
			console.error('Error creating template:', error);
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
			const name = formData.get('name') as string;
			const categoryId = formData.get('categoryId') as string;
			const description = formData.get('description') as string;

			// Validate required fields
			if (!id) {
				return fail(400, { error: 'ID template diperlukan', success: false });
			}

			if (!name || name.trim() === '') {
				return fail(400, { error: 'Nama template wajib diisi', success: false });
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

			// Update the template
			await transactionTemplateQueries.update(db, userId, id, {
				name: name.trim(),
				categoryId: categoryId || undefined,
				description: description || undefined
			});

			return {
				success: true,
				message: 'Template berhasil diperbarui'
			};
		} catch (error) {
			console.error('Error updating template:', error);
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
		} catch (error) {
			console.error('Error deleting template:', error);
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
		} catch (error) {
			console.error('Error toggling template:', error);
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	}
};
