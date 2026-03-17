import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { categoryQueries } from '$lib/server/db/queries';

interface CreateCategoryBody {
	name: string;
	type: 'income' | 'expense';
	code?: string;
	icon?: string;
	color?: string;
}

// GET /api/categories - Returns all categories for authenticated user (system + custom)
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		const categories = await categoryQueries.findAll(db, userId);

		// Map to API response format
		const mappedCategories = categories.map((cat) => ({
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
		}));

		return json({ categories: mappedCategories });
	} catch {
		console.error('Error fetching categories:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/categories - Creates a new custom category
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = (await request.json()) as CreateCategoryBody;

		// Validate required fields
		if (!body.name || body.name.trim() === '') {
			return json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
		}

		if (!body.type || (body.type !== 'income' && body.type !== 'expense')) {
			return json({ error: 'Tipe kategori wajib dipilih (income/expense)' }, { status: 400 });
		}

		const db = getDb();

		// Generate code if not provided
		let code = body.code;
		if (!code) {
			// Generate a unique code for the category
			code = await categoryQueries.generateNextCode(db, userId, body.type);
		} else {
			// Validate custom code format
			const existing = await categoryQueries.findByCode(db, userId, code);
			if (existing) {
				return json({ error: 'Kode kategori sudah digunakan' }, { status: 400 });
			}
		}

		// Create the category
		const categoryId = crypto.randomUUID();
		await categoryQueries.create(db, {
			userId,
			code,
			name: body.name.trim(),
			type: body.type,
			icon: body.icon,
			color: body.color
		});

		const now = new Date().toISOString();
		return json(
			{
				message: 'Kategori berhasil dibuat',
				category: {
					id: categoryId,
					name: body.name.trim(),
					type: body.type,
					code,
					isSystem: false,
					isActive: true,
					icon: body.icon ?? null,
					color: body.color ?? null,
					createdAt: now,
					updatedAt: now
				}
			},
			{ status: 201 }
		);
	} catch {
		console.error('Error creating category:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
