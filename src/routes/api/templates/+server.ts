import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transactionTemplateQueries } from '$lib/server/db/queries';

interface CreateTemplateBody {
	name: string;
	type: 'income' | 'expense';
	categoryId?: string;
	description?: string;
}

// GET /api/templates - Returns all templates for authenticated user (system + custom)
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const templates = await transactionTemplateQueries.findAllActive(db, userId);

		// Map to API response format
		const mappedTemplates = templates.map((tmpl) => ({
			id: tmpl.id,
			name: tmpl.name,
			type: tmpl.type,
			categoryId: tmpl.categoryId,
			description: tmpl.description,
			isSystem: tmpl.isSystem,
			isActive: tmpl.isActive,
			createdAt: tmpl.createdAt,
			updatedAt: tmpl.updatedAt
		}));

		return json({ templates: mappedTemplates });
	} catch (error) {
		console.error('Error fetching templates:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/templates - Creates a new custom template
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as CreateTemplateBody;

		// Validate required fields
		if (!body.name || body.name.trim() === '') {
			return json({ error: 'Nama template wajib diisi' }, { status: 400 });
		}

		if (!body.type || (body.type !== 'income' && body.type !== 'expense')) {
			return json({ error: 'Tipe transaksi wajib dipilih (income/expense)' }, { status: 400 });
		}

		const db = getDb();

		// Create the template
		const templateId = crypto.randomUUID();
		await transactionTemplateQueries.create(db, {
			userId,
			name: body.name.trim(),
			type: body.type,
			categoryId: body.categoryId,
			description: body.description,
			isSystem: false
		});

		const now = new Date().toISOString();
		return json(
			{
				message: 'Template berhasil dibuat',
				template: {
					id: templateId,
					name: body.name.trim(),
					type: body.type,
					categoryId: body.categoryId ?? null,
					description: body.description ?? null,
					isSystem: false,
					isActive: true,
					createdAt: now,
					updatedAt: now
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating template:', error);
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
