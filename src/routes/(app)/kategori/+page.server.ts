import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import { categoryQueries, transactionQueries } from '$lib/server/db/queries';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const categories = await categoryQueries.findAll(db, userId);

		// Group categories by type
		const incomeCategories = categories.filter((c) => c.type === 'income');
		const expenseCategories = categories.filter((c) => c.type === 'expense');

		// Group by SAK EMKM code prefix (first digit)
		const groupByCodePrefix = (cats: typeof categories) => {
			const groups: Record<string, typeof cats> = {};
			for (const cat of cats) {
				const prefix = cat.code.charAt(0);
				if (!groups[prefix]) {
					groups[prefix] = [];
				}
				groups[prefix].push(cat);
			}
			return groups;
		};

		return {
			categories: {
				income: {
					all: incomeCategories,
					groups: groupByCodePrefix(incomeCategories)
				},
				expense: {
					all: expenseCategories,
					groups: groupByCodePrefix(expenseCategories)
				}
			}
		};
	} catch (error) {
		console.error('Error fetching categories:', error);
		return {
			categories: {
				income: { all: [], groups: {} },
				expense: { all: [], groups: {} }
			},
			error: 'Gagal memuat data kategori'
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized' });
		}

		const userId = locals.user.id;
		const db = getDb();

		try {
			const formData = await request.formData();
			const name = formData.get('name') as string;
			const type = formData.get('type') as 'income' | 'expense';

			// Validate required fields
			if (!name || name.trim() === '') {
				return fail(400, { error: 'Nama kategori wajib diisi', success: false });
			}

			if (!type || (type !== 'income' && type !== 'expense')) {
				return fail(400, { error: 'Tipe kategori wajib dipilih', success: false });
			}

			// Generate a unique code for the category
			const newCode = await categoryQueries.generateNextCode(db, userId, type);

			// Create the category
			const categoryId = crypto.randomUUID();
			await categoryQueries.create(db, {
				userId,
				code: newCode,
				name: name.trim(),
				type
			});

			const now = new Date().toISOString();
			return {
				success: true,
				message: 'Kategori berhasil dibuat',
				category: {
					id: categoryId,
					code: newCode,
					name: name.trim(),
					type,
					isSystem: false,
					isActive: true,
					icon: null,
					color: null,
					createdAt: now,
					updatedAt: now
				}
			};
		} catch (error) {
			console.error('Error creating category:', error);
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

			// Validate required fields
			if (!id) {
				return fail(400, { error: 'ID kategori diperlukan', success: false });
			}

			if (!name || name.trim() === '') {
				return fail(400, { error: 'Nama kategori wajib diisi', success: false });
			}

			// Check if category exists
			const existingCategory = await categoryQueries.findById(db, userId, id);
			if (!existingCategory) {
				return fail(404, { error: 'Kategori tidak ditemukan', success: false });
			}

			// System categories cannot be renamed
			if (existingCategory.isSystem) {
				return fail(400, { error: 'Kategori sistem tidak dapat diubah', success: false });
			}

			// Update the category
			await categoryQueries.update(db, userId, id, { name: name.trim() });

			return {
				success: true,
				message: 'Kategori berhasil diperbarui'
			};
		} catch (error) {
			console.error('Error updating category:', error);
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
				return fail(400, { error: 'ID kategori diperlukan', success: false });
			}

			// Check if category exists
			const existingCategory = await categoryQueries.findById(db, userId, id);
			if (!existingCategory) {
				return fail(404, { error: 'Kategori tidak ditemukan', success: false });
			}

			// Toggle the category status
			await categoryQueries.update(db, userId, id, { isActive });

			return {
				success: true,
				message: isActive ? 'Kategori berhasil diaktifkan' : 'Kategori berhasil dinonaktifkan'
			};
		} catch (error) {
			console.error('Error toggling category:', error);
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
				return fail(400, { error: 'ID kategori diperlukan', success: false });
			}

			// Check if category exists
			const existingCategory = await categoryQueries.findById(db, userId, id);
			if (!existingCategory) {
				return fail(404, { error: 'Kategori tidak ditemukan', success: false });
			}

			// System categories cannot be deleted
			if (existingCategory.isSystem) {
				return fail(400, { error: 'Kategori sistem tidak dapat dihapus', success: false });
			}

			// Check if category has transactions - if so, just deactivate
			const hasTransactions = await transactionQueries.hasTransactionsByCategory(db, id);

			if (hasTransactions) {
				await categoryQueries.update(db, userId, id, { isActive: false });
				return {
					success: true,
					message: 'Kategori memiliki transaksi dan telah dinonaktifkan'
				};
			}

			// Delete the category
			await categoryQueries.delete(db, userId, id);

			return {
				success: true,
				message: 'Kategori berhasil dihapus'
			};
		} catch (error) {
			console.error('Error deleting category:', error);
			return fail(500, { error: 'Terjadi kesalahan server', success: false });
		}
	}
};
