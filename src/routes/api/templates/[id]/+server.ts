import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { transactionTemplateQueries } from '#lib/server/db/queries/index.ts';
import { resolveTemplateCategory } from '#lib/server/templates/category.ts';
import {
	isCategoryType,
	validateTemplateDescription,
	validateTemplateName
} from '#lib/shared/validation/category.ts';

interface UpdateTemplateBody {
	name?: unknown;
	type?: unknown;
	categoryId?: unknown;
	description?: unknown;
	isActive?: unknown;
}

// GET /api/templates/[id] - Get a single template
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const templateId = params.id;

	if (!templateId) {
		return json({ error: 'ID template diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		const template = await transactionTemplateQueries.findById(db, userId, templateId);

		if (!template) {
			return json({ error: 'Template tidak ditemukan' }, { status: 404 });
		}

		return json({
			template: {
				id: template.id,
				name: template.name,
				type: template.type,
				categoryId: template.categoryId,
				description: template.description,
				isSystem: template.isSystem,
				isActive: template.isActive,
				createdAt: template.createdAt,
				updatedAt: template.updatedAt
			}
		});
	} catch {
		console.error('Error fetching template:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// PUT /api/templates/[id] - Update a template (system templates cannot be updated)
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const templateId = params.id;

	if (!templateId) {
		return json({ error: 'ID template diperlukan' }, { status: 400 });
	}

	try {
		const body = (await request.json()) as UpdateTemplateBody;
		const db = getDb();

		// Check if template exists
		const existingTemplate = await transactionTemplateQueries.findById(db, userId, templateId);

		if (!existingTemplate) {
			return json({ error: 'Template tidak ditemukan' }, { status: 404 });
		}

		// System templates cannot be modified
		if (existingTemplate.isSystem) {
			return json({ error: 'Template sistem tidak dapat diubah' }, { status: 400 });
		}

		// Validate and build update data
		const updateData: {
			name?: string;
			type?: 'income' | 'expense';
			categoryId?: string | null;
			description?: string | null;
			isActive?: boolean;
		} = {};

		if (body.name !== undefined) {
			const name = validateTemplateName(body.name);
			if (!name.ok) {
				return json({ error: name.error }, { status: 400 });
			}
			updateData.name = name.value;
		}
		if (body.type !== undefined) {
			if (!isCategoryType(body.type)) {
				return json({ error: 'Tipe transaksi wajib dipilih (income/expense)' }, { status: 400 });
			}
			updateData.type = body.type;
		}
		if (body.categoryId !== undefined) {
			if (body.categoryId !== null && typeof body.categoryId !== 'string') {
				return json({ error: 'Kategori tidak ditemukan' }, { status: 400 });
			}
			updateData.categoryId = body.categoryId || null;
		}
		const description = validateTemplateDescription(body.description);
		if (!description.ok) {
			return json({ error: description.error }, { status: 400 });
		}
		if (description.value !== undefined) {
			updateData.description = description.value;
		}
		if (body.isActive !== undefined) {
			if (typeof body.isActive !== 'boolean') {
				return json({ error: 'Status isActive harus true atau false' }, { status: 400 });
			}
			updateData.isActive = body.isActive;
		}

		// A new category, or a new type for the current one, must be the user's own
		// active category of the template's type.
		const nextType = updateData.type ?? (existingTemplate.type as 'income' | 'expense');
		const nextCategoryId =
			updateData.categoryId !== undefined ? updateData.categoryId : existingTemplate.categoryId;
		if (nextType !== existingTemplate.type || nextCategoryId !== existingTemplate.categoryId) {
			const categoryCheck = await resolveTemplateCategory(db, userId, nextCategoryId, nextType);
			if (!categoryCheck.ok) {
				return json({ error: categoryCheck.error }, { status: 400 });
			}
		}

		// Update the template
		await transactionTemplateQueries.update(db, userId, templateId, updateData);

		return json({
			message: 'Template berhasil diperbarui',
			template: {
				id: templateId,
				name: updateData.name ?? existingTemplate.name,
				type: updateData.type ?? existingTemplate.type,
				categoryId: nextCategoryId,
				description:
					updateData.description !== undefined
						? updateData.description
						: existingTemplate.description,
				isSystem: existingTemplate.isSystem,
				isActive: updateData.isActive ?? existingTemplate.isActive,
				createdAt: existingTemplate.createdAt,
				updatedAt: new Date().toISOString()
			}
		});
	} catch {
		console.error('Error updating template:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// DELETE /api/templates/[id] - Delete a template (system templates cannot be deleted)
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const templateId = params.id;

	if (!templateId) {
		return json({ error: 'ID template diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		// Check if template exists
		const existingTemplate = await transactionTemplateQueries.findById(db, userId, templateId);

		if (!existingTemplate) {
			return json({ error: 'Template tidak ditemukan' }, { status: 404 });
		}

		// System templates cannot be deleted
		if (existingTemplate.isSystem) {
			return json({ error: 'Template sistem tidak dapat dihapus' }, { status: 400 });
		}

		// Delete the template (hard delete)
		await transactionTemplateQueries.delete(db, userId, templateId);

		return json({
			message: 'Template berhasil dihapus'
		});
	} catch {
		console.error('Error deleting template:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
