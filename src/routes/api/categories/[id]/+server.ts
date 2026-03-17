import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { categoryQueries, transactionQueries } from '$lib/server/db/queries';

interface UpdateCategoryBody {
	name?: string;
}

// GET /api/categories/[id] - Get a single category
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const categoryId = params.id;

	if (!categoryId) {
		return json({ error: 'ID kategori diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		const cat = await categoryQueries.findById(db, userId, categoryId);

		if (!cat) {
			return json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
		}

		return json({
			category: {
				id: cat.id,
				name: cat.name,
				type: cat.type,
				code: cat.code,
				isSystem: cat.isSystem,
				isActive: cat.isActive,
				icon: cat.icon,
				color: cat.color,
				createdAt: cat.createdAt,
				updatedAt: cat.updatedAt
			}
		});
	} catch {
		console.error('Error fetching category:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PUT /api/categories/[id] - Rename a category (system categories cannot be renamed)
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const categoryId = params.id;

	if (!categoryId) {
		return json({ error: 'ID kategori diperlukan' }, { status: 400 });
	}

	try {
		const body = (await request.json()) as UpdateCategoryBody;
		const db = getDb();

		// Check if category exists
		const existingCategory = await categoryQueries.findById(db, userId, categoryId);

		if (!existingCategory) {
			return json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
		}

		// System categories cannot be renamed
		if (existingCategory.isSystem) {
			return json({ error: 'Kategori sistem tidak dapat diubah' }, { status: 400 });
		}

		// Validate name
		if (body.name !== undefined && body.name.trim() === '') {
			return json({ error: 'Nama kategori tidak boleh kosong' }, { status: 400 });
		}

		// Build update data
		const updateData: {
			name?: string;
		} = {};

		if (body.name !== undefined) {
			updateData.name = body.name.trim();
		}

		// Update the category
		await categoryQueries.update(db, userId, categoryId, updateData);

		return json({
			message: 'Kategori berhasil diperbarui',
			category: {
				id: existingCategory.id,
				name: updateData.name ?? existingCategory.name,
				type: existingCategory.type,
				code: existingCategory.code,
				isSystem: existingCategory.isSystem,
				isActive: existingCategory.isActive,
				icon: existingCategory.icon,
				color: existingCategory.color,
				createdAt: existingCategory.createdAt,
				updatedAt: new Date().toISOString()
			}
		});
	} catch {
		console.error('Error updating category:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PATCH /api/categories/[id] - Toggle is_active status
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const categoryId = params.id;

	if (!categoryId) {
		return json({ error: 'ID kategori diperlukan' }, { status: 400 });
	}

	try {
		const body = (await request.json()) as { isActive?: boolean };
		const db = getDb();

		// Check if category exists
		const existingCategory = await categoryQueries.findById(db, userId, categoryId);

		if (!existingCategory) {
			return json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
		}

		// Validate isActive
		if (body.isActive === undefined) {
			return json({ error: 'Status isActive diperlukan' }, { status: 400 });
		}

		// Update the category status
		await categoryQueries.update(db, userId, categoryId, { isActive: body.isActive });

		return json({
			message: body.isActive ? 'Kategori berhasil diaktifkan' : 'Kategori berhasil dinonaktifkan',
			category: {
				id: existingCategory.id,
				name: existingCategory.name,
				type: existingCategory.type,
				code: existingCategory.code,
				isSystem: existingCategory.isSystem,
				isActive: body.isActive,
				icon: existingCategory.icon,
				color: existingCategory.color,
				createdAt: existingCategory.createdAt,
				updatedAt: new Date().toISOString()
			}
		});
	} catch {
		console.error('Error toggling category status:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// DELETE /api/categories/[id] - Delete a category (system categories cannot be deleted, categories with transactions are deactivated)
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const categoryId = params.id;

	if (!categoryId) {
		return json({ error: 'ID kategori diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		// Check if category exists
		const existingCategory = await categoryQueries.findById(db, userId, categoryId);

		if (!existingCategory) {
			return json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
		}

		// System categories cannot be deleted
		if (existingCategory.isSystem) {
			return json({ error: 'Kategori sistem tidak dapat dihapus' }, { status: 400 });
		}

		// Check if category has transactions
		const hasTxns = await transactionQueries.hasTransactionsByCategory(db, categoryId);

		if (hasTxns) {
			// Categories with referenced transactions cannot be deleted, only deactivated
			await categoryQueries.update(db, userId, categoryId, { isActive: false });
			return json({
				message: 'Kategori memiliki transaksi terkait dan telah dinonaktifkan'
			});
		}

		// Delete the category (hard delete)
		await categoryQueries.delete(db, userId, categoryId);

		return json({
			message: 'Kategori berhasil dihapus'
		});
	} catch {
		console.error('Error deleting category:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
