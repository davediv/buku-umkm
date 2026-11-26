import type { SQLiteDb } from '$lib/server/db';
import { categoryQueries } from '$lib/server/db/queries';

export type TemplateType = 'income' | 'expense';

export type TemplateCategoryResult =
	{ ok: true; category: { id: string; name: string } | null } | { ok: false; error: string };

/**
 * Checks the category a template is about to reference. The lookup is scoped to
 * the signed-in user, so another user's category reads exactly like one that
 * does not exist: both fail validation instead of reaching the foreign key.
 *
 * `undefined`, `null` and `''` mean "no category" and always pass.
 */
export async function resolveTemplateCategory(
	db: SQLiteDb,
	userId: string,
	categoryId: unknown,
	type: TemplateType
): Promise<TemplateCategoryResult> {
	if (categoryId === undefined || categoryId === null || categoryId === '') {
		return { ok: true, category: null };
	}
	if (typeof categoryId !== 'string') {
		return { ok: false, error: 'Kategori tidak ditemukan' };
	}

	const found = await categoryQueries.findById(db, userId, categoryId);
	if (!found) {
		return { ok: false, error: 'Kategori tidak ditemukan' };
	}
	if (!found.isActive) {
		return { ok: false, error: 'Kategori sudah dinonaktifkan. Pilih kategori lain.' };
	}
	if (found.type !== type) {
		return {
			ok: false,
			error:
				type === 'income'
					? 'Pilih kategori pemasukan untuk template pemasukan'
					: 'Pilih kategori pengeluaran untuk template pengeluaran'
		};
	}

	return { ok: true, category: { id: found.id, name: found.name } };
}
