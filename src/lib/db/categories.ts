import { db, generateId, now } from './index';
import type { CategoryRecord, SyncStatus } from './schema';

// ============================================================================
// Category CRUD Operations
// ============================================================================

export interface CreateCategoryInput {
	userId: string;
	code: string;
	name: string;
	type: 'income' | 'expense';
	isSystem?: boolean;
	icon?: string;
	color?: string;
}

export interface UpdateCategoryInput {
	code?: string;
	name?: string;
	type?: 'income' | 'expense';
	isActive?: boolean;
	icon?: string;
	color?: string;
}

/**
 * Create a new category
 */
export async function createCategory(input: CreateCategoryInput): Promise<CategoryRecord> {
	const record: CategoryRecord = {
		id: generateId(),
		userId: input.userId,
		code: input.code,
		name: input.name,
		type: input.type,
		isSystem: input.isSystem ?? false,
		isActive: true,
		icon: input.icon ?? null,
		color: input.color ?? null,
		createdAt: now(),
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.categories.add(record);
	return record;
}

/**
 * Get category by ID
 */
export async function getCategory(id: string): Promise<CategoryRecord | undefined> {
	return db.categories.get(id);
}

/**
 * Get all categories for a user
 */
export async function getCategories(
	userId: string,
	options?: {
		type?: 'income' | 'expense';
		isActive?: boolean;
		syncStatus?: SyncStatus;
	}
): Promise<CategoryRecord[]> {
	const collection = db.categories.where('userId').equals(userId);
	let results = await collection.toArray();

	if (options?.type) {
		results = results.filter((c) => c.type === options.type);
	}
	if (options?.isActive !== undefined) {
		results = results.filter((c) => c.isActive === options.isActive);
	}
	if (options?.syncStatus) {
		results = results.filter((c) => c.syncStatus === options.syncStatus);
	}

	// Sort by code
	results.sort((a, b) => a.code.localeCompare(b.code));
	return results;
}

/**
 * Get category by code for a user
 */
export async function getCategoryByCode(
	userId: string,
	code: string
): Promise<CategoryRecord | undefined> {
	const categories = await db.categories
		.where('userId')
		.equals(userId)
		.and((c) => c.code === code)
		.toArray();
	return categories[0];
}

/**
 * Update a category
 */
export async function updateCategory(
	id: string,
	input: UpdateCategoryInput
): Promise<CategoryRecord | undefined> {
	const existing = await db.categories.get(id);
	if (!existing) return undefined;

	const updated: CategoryRecord = {
		...existing,
		...input,
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.categories.put(updated);
	return updated;
}

/**
 * Delete a category (soft delete)
 */
export async function deleteCategory(id: string): Promise<boolean> {
	const existing = await db.categories.get(id);
	if (!existing) return false;

	existing.isActive = false;
	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.categories.put(existing);
	return true;
}

/**
 * Get pending categories for sync
 */
export async function getPendingCategories(userId: string): Promise<CategoryRecord[]> {
	return db.categories
		.where('userId')
		.equals(userId)
		.and((c) => c.syncStatus === 'pending')
		.toArray();
}

/**
 * Mark categories as synced
 */
export async function markCategoriesSynced(ids: string[]): Promise<void> {
	await db.transaction('rw', db.categories, async () => {
		for (const id of ids) {
			const category = await db.categories.get(id);
			if (category) {
				category.syncStatus = 'synced';
				await db.categories.put(category);
			}
		}
	});
}
