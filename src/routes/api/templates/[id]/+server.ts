import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transactionTemplateQueries } from '$lib/server/db/queries';

interface UpdateTemplateBody {
	name?: string;
	type?: 'income' | 'expense';
	categoryId?: string | null;
	description?: string | null;
	isActive?: boolean;
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
	} catch (error) {
		console.error('Error fetching template:', error);
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

		// Validate name
		if (body.name !== undefined && body.name.trim() === '') {
			return json({ error: 'Nama template tidak boleh kosong' }, { status: 400 });
		}

		// Build update data
		const updateData: {
			name?: string;
			type?: 'income' | 'expense';
			categoryId?: string | null;
			description?: string | null;
			isActive?: boolean;
		} = {};

		if (body.name !== undefined) {
			updateData.name = body.name.trim();
		}
		if (body.type !== undefined) {
			updateData.type = body.type;
		}
		if (body.categoryId !== undefined) {
			updateData.categoryId = body.categoryId;
		}
		if (body.description !== undefined) {
			updateData.description = body.description;
		}
		if (body.isActive !== undefined) {
			updateData.isActive = body.isActive;
		}

		// Update the template
		await transactionTemplateQueries.update(db, userId, templateId, updateData);

		return json({
			message: 'Template berhasil diperbarui',
			template: {
				id: templateId,
				name: updateData.name ?? existingTemplate.name,
				type: updateData.type ?? existingTemplate.type,
				categoryId: updateData.categoryId ?? existingTemplate.categoryId,
				description: updateData.description ?? existingTemplate.description,
				isSystem: existingTemplate.isSystem,
				isActive: updateData.isActive ?? existingTemplate.isActive,
				createdAt: existingTemplate.createdAt,
				updatedAt: new Date().toISOString()
			}
		});
	} catch (error) {
		console.error('Error updating template:', error);
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
	} catch (error) {
		console.error('Error deleting template:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
