import { LOAN_INTEREST_CATEGORY_CODES } from '#lib/debts/interest.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { categoryQueries } from '#lib/server/db/queries/index.ts';
import {
	isCategoryType,
	validateCategoryCode,
	validateCategoryColor,
	validateCategoryIcon,
	validateCategoryName
} from '#lib/shared/validation/category.ts';

interface CreateCategoryBody {
	name?: unknown;
	type?: unknown;
	code?: unknown;
	icon?: unknown;
	color?: unknown;
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

		// Validate fields
		const name = validateCategoryName(body.name);
		if (!name.ok) {
			return json({ error: name.error }, { status: 400 });
		}

		if (!isCategoryType(body.type)) {
			return json({ error: 'Tipe kategori wajib dipilih (income/expense)' }, { status: 400 });
		}
		const type = body.type;

		const customCode = validateCategoryCode(body.code, type);
		if (!customCode.ok) {
			return json({ error: customCode.error }, { status: 400 });
		}
		// The loan interest categories are found by these codes; a custom one must not take them.
		if (customCode.value && LOAN_INTEREST_CATEGORY_CODES.has(customCode.value)) {
			return json(
				{
					error: `Kode ${customCode.value} disediakan untuk kategori bunga pinjaman. Pilih kode lain.`
				},
				{ status: 400 }
			);
		}

		const icon = validateCategoryIcon(body.icon);
		if (!icon.ok) {
			return json({ error: icon.error }, { status: 400 });
		}

		const color = validateCategoryColor(body.color);
		if (!color.ok) {
			return json({ error: color.error }, { status: 400 });
		}

		const db = getDb();

		// Generate code if not provided
		let code = customCode.value;
		if (!code) {
			// Generate a unique code for the category
			code = await categoryQueries.generateNextCode(db, userId, type);
		} else {
			const existing = await categoryQueries.findByCode(db, userId, code);
			if (existing) {
				return json({ error: 'Kode kategori sudah digunakan' }, { status: 400 });
			}
		}

		// Create the category
		const createdCategory = await categoryQueries.create(db, {
			userId,
			code,
			name: name.value,
			type,
			icon: icon.value,
			color: color.value
		});

		return json(
			{
				message: 'Kategori berhasil dibuat',
				category: createdCategory
			},
			{ status: 201 }
		);
	} catch {
		console.error('Error creating category:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};
