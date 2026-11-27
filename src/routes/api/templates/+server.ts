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

interface CreateTemplateBody {
	name?: unknown;
	type?: unknown;
	categoryId?: unknown;
	description?: unknown;
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
	} catch {
		console.error('Error fetching templates:');
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

		// Validate fields
		const name = validateTemplateName(body.name);
		if (!name.ok) {
			return json({ error: name.error }, { status: 400 });
		}

		if (!isCategoryType(body.type)) {
			return json({ error: 'Tipe transaksi wajib dipilih (income/expense)' }, { status: 400 });
		}
		const type = body.type;

		const description = validateTemplateDescription(body.description);
		if (!description.ok) {
			return json({ error: description.error }, { status: 400 });
		}

		const db = getDb();

		const categoryCheck = await resolveTemplateCategory(db, userId, body.categoryId, type);
		if (!categoryCheck.ok) {
			return json({ error: categoryCheck.error }, { status: 400 });
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

		return json(
			{
				message: 'Template berhasil dibuat',
				template: createdTemplate
			},
			{ status: 201 }
		);
	} catch {
		console.error('Error creating template:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
